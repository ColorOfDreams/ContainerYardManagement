import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateYardVisitDto } from './dto/create-yard-visit.dto';
import { UpdateYardVisitDto } from './dto/update-yard-visit.dto';

const TERMINAL_STATUSES = ['CLOSED', 'REJECTED', 'CANCELLED'];

const YARD_VISIT_COLUMNS =
  'yard_visit_id, shipment_container_id, current_warehouse_id, eta, etd, ata, atd, free_time_days_snapshot, status, created_at, updated_at';

// ============================================================
// YardVisitService — FR-04/05/08/09. State machine đúng theo
// State_Business_Kho_bai_Container_v1.docx mục 4.5:
//   PLANNED -> ARRIVED -> IN_YARD -> STAGING -> DEPARTED -> CLOSED
//   PLANNED -> CANCELLED (Case 2, sự cố trước khi tới)
//   ARRIVED -> REJECTED (Inspection Gate-in Fail — xử lý ở InspectionService)
//
// current_warehouse_id / Movement.from_warehouse_id|to_warehouse_id luôn null
// trong toàn bộ service này — chỉ được set khi Inspection Gate-in Pass
// (xem InspectionService), đây là đơn giản hóa có chủ đích theo SRS v6/FR-06.
// ============================================================
@Injectable()
export class YardVisitService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateYardVisitDto) {
    const contract = await this.db.query<{ free_time_days: number }>(
      `SELECT c.free_time_days
       FROM management.shipment_container sc
       JOIN management.shipment s ON s.shipment_id = sc.shipment_id
       JOIN management.contract c ON c.contract_id = s.contract_id
       WHERE sc.shipment_container_id = $1`,
      [dto.shipmentContainerId],
    );
    if (contract.rows.length === 0) throw new NotFoundException(`Shipment_Container ${dto.shipmentContainerId} không tồn tại`);

    const result = await this.db.query(
      `INSERT INTO management.yard_visit (shipment_container_id, eta, etd, free_time_days_snapshot)
       VALUES ($1, $2, $3, $4)
       RETURNING ${YARD_VISIT_COLUMNS}`,
      [dto.shipmentContainerId, dto.eta, dto.etd ?? null, contract.rows[0].free_time_days],
    );
    return result.rows[0];
  }

  async findAll() {
    const result = await this.db.query(`SELECT ${YARD_VISIT_COLUMNS} FROM management.yard_visit ORDER BY eta DESC`);
    return result.rows;
  }

  async findOne(yardVisitId: string) {
    const result = await this.db.query(`SELECT ${YARD_VISIT_COLUMNS} FROM management.yard_visit WHERE yard_visit_id = $1`, [yardVisitId]);
    if (result.rows.length === 0) throw new NotFoundException(`Yard Visit ${yardVisitId} không tồn tại`);
    return result.rows[0];
  }

  async update(yardVisitId: string, dto: UpdateYardVisitDto) {
    const visit = await this.findOne(yardVisitId);
    if (TERMINAL_STATUSES.includes(visit.status)) {
      throw new ConflictException(`Yard Visit đã ở trạng thái cuối (${visit.status}) — không đổi lịch được nữa`);
    }
    const result = await this.db.query(
      `UPDATE management.yard_visit
       SET eta = COALESCE($1, eta), etd = COALESCE($2, etd), updated_at = CURRENT_TIMESTAMP
       WHERE yard_visit_id = $3
       RETURNING ${YARD_VISIT_COLUMNS}`,
      [dto.eta ?? null, dto.etd ?? null, yardVisitId],
    );
    return result.rows[0];
  }

  async cancel(yardVisitId: string, reason: string) {
    void reason; // ghi audit trail sau này — xem ghi chú tương tự ở ContractService.terminate
    const visit = await this.findOne(yardVisitId);
    if (visit.status !== 'PLANNED') {
      throw new ConflictException(`Chỉ Yard Visit đang PLANNED mới CANCELLED được (hiện tại: ${visit.status})`);
    }
    const result = await this.db.query(
      `UPDATE management.yard_visit SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
       WHERE yard_visit_id = $1 RETURNING ${YARD_VISIT_COLUMNS}`,
      [yardVisitId],
    );
    return result.rows[0];
  }

  async gateIn(yardVisitId: string, ata?: string) {
    const visit = await this.findOne(yardVisitId);
    if (visit.status !== 'PLANNED') {
      throw new ConflictException(`Chỉ Yard Visit đang PLANNED mới Gate-in được (hiện tại: ${visit.status})`);
    }
    const result = await this.db.query(
      `UPDATE management.yard_visit
       SET status = 'ARRIVED', ata = $1, updated_at = CURRENT_TIMESTAMP
       WHERE yard_visit_id = $2
       RETURNING ${YARD_VISIT_COLUMNS}`,
      [ata ? new Date(ata) : new Date(), yardVisitId],
    );
    await this.markShipmentArrivedIfFirst(yardVisitId);
    return result.rows[0];
  }

  async stage(yardVisitId: string) {
    const visit = await this.findOne(yardVisitId);
    if (visit.status !== 'IN_YARD') {
      throw new ConflictException(`Chỉ Yard Visit đang IN_YARD mới Stage được (hiện tại: ${visit.status})`);
    }
    const openCustomsHold = await this.db.query(
      `SELECT 1 FROM management.event WHERE yard_visit_id = $1 AND event_type = 'Customs Hold' AND resolution_status = 'Open' LIMIT 1`,
      [yardVisitId],
    );
    if (openCustomsHold.rows.length > 0) {
      throw new ConflictException('Đang có Event Customs Hold chưa Resolved — không thể chuyển sang Staging (State Business Case 5)');
    }

    return this.db.transaction(async (client) => {
      await client.query(
        `INSERT INTO management.movement (yard_visit_id, movement_type, from_warehouse_id, to_warehouse_id)
         VALUES ($1, 'Rehandle', NULL, NULL)`,
        [yardVisitId],
      );
      const result = await client.query(
        `UPDATE management.yard_visit SET status = 'STAGING', updated_at = CURRENT_TIMESTAMP
         WHERE yard_visit_id = $1 RETURNING ${YARD_VISIT_COLUMNS}`,
        [yardVisitId],
      );
      return result.rows[0];
    });
  }

  async gateOut(yardVisitId: string, atd?: string, vehicleId?: string) {
    const visit = await this.findOne(yardVisitId);
    if (visit.status !== 'STAGING') {
      throw new ConflictException(`Chỉ Yard Visit đang STAGING mới Gate-out được (hiện tại: ${visit.status})`);
    }
    const gateOutInspection = await this.db.query(
      `SELECT 1 FROM management.inspection WHERE yard_visit_id = $1 AND inspection_type = 'Gate-out' LIMIT 1`,
      [yardVisitId],
    );
    if (gateOutInspection.rows.length === 0) {
      throw new ConflictException('Cần tạo Inspection type=Gate-out cho Yard Visit này trước khi Gate-out (FR-09.2)');
    }

    return this.db.transaction(async (client) => {
      // [SỬA] from_warehouse_id lấy đúng kho hiện tại (đã gán lúc Gate-in, FR-06) —
      // Gate-out giải phóng kho: current_warehouse_id trả về null.
      await client.query(
        `INSERT INTO management.movement (yard_visit_id, movement_type, from_warehouse_id, to_warehouse_id, vehicle_id)
         VALUES ($1, 'Gate-out', $2, NULL, $3)`,
        [yardVisitId, visit.current_warehouse_id, vehicleId ?? null],
      );
      const result = await client.query(
        `UPDATE management.yard_visit
         SET status = 'DEPARTED', atd = $1, current_warehouse_id = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE yard_visit_id = $2
         RETURNING ${YARD_VISIT_COLUMNS}`,
        [atd ? new Date(atd) : new Date(), yardVisitId],
      );
      return result.rows[0];
    });
  }

  async close(yardVisitId: string) {
    const visit = await this.findOne(yardVisitId);
    if (visit.status !== 'DEPARTED') {
      throw new ConflictException(`Chỉ Yard Visit đang DEPARTED mới Close được (hiện tại: ${visit.status})`);
    }
    const result = await this.db.query(
      `UPDATE management.yard_visit SET status = 'CLOSED', updated_at = CURRENT_TIMESTAMP
       WHERE yard_visit_id = $1 RETURNING ${YARD_VISIT_COLUMNS}`,
      [yardVisitId],
    );
    await this.markShipmentCompletedIfAllClosed(yardVisitId);
    return result.rows[0];
  }

  // ---- Derived Shipment.status transitions — State Business mục 4.2 ----

  private async markShipmentArrivedIfFirst(yardVisitId: string) {
    const shipment = await this.shipmentOf(yardVisitId);
    if (shipment && shipment.status === 'In Transit') {
      await this.db.query(`UPDATE management.shipment SET status = 'Arrived', updated_at = CURRENT_TIMESTAMP WHERE shipment_id = $1`, [
        shipment.shipment_id,
      ]);
    }
  }

  private async markShipmentCompletedIfAllClosed(yardVisitId: string) {
    const shipment = await this.shipmentOf(yardVisitId);
    if (!shipment || shipment.status !== 'Arrived') return;

    const result = await this.db.query<{ total: string; closed_count: string }>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (
                WHERE EXISTS (
                  SELECT 1 FROM management.yard_visit yv
                  WHERE yv.shipment_container_id = sc.shipment_container_id AND yv.status = 'CLOSED'
                )
              ) AS closed_count
       FROM management.shipment_container sc
       WHERE sc.shipment_id = $1`,
      [shipment.shipment_id],
    );
    const { total, closed_count } = result.rows[0];
    if (Number(total) === Number(closed_count)) {
      await this.db.query(`UPDATE management.shipment SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE shipment_id = $1`, [
        shipment.shipment_id,
      ]);
    }
  }

  private async shipmentOf(yardVisitId: string) {
    const result = await this.db.query<{ shipment_id: string; status: string }>(
      `SELECT s.shipment_id, s.status
       FROM management.yard_visit yv
       JOIN management.shipment_container sc ON sc.shipment_container_id = yv.shipment_container_id
       JOIN management.shipment s ON s.shipment_id = sc.shipment_id
       WHERE yv.yard_visit_id = $1`,
      [yardVisitId],
    );
    return result.rows[0] ?? null;
  }
}
