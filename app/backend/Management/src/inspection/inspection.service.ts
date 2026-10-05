import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';

const INSPECTION_COLUMNS = 'inspection_id, yard_visit_id, inspection_type, seal_check, result, fail_reason, damage_notes, inspected_at, inspected_by';

// DTO dùng tên enum kiểu "GateIn"/"GateOut"/"AdHoc" (khớp quy ước Prisma cũ);
// DB lưu đúng theo SRS: "Gate-in"/"Gate-out"/"Ad-hoc" — cần map tay vì không
// còn Prisma tự dịch @map nữa.
const INSPECTION_TYPE_DB: Record<string, string> = {
  GateIn: 'Gate-in',
  GateOut: 'Gate-out',
  AdHoc: 'Ad-hoc',
};

// ============================================================
// InspectionService — FR-05/09. Kết quả Inspection tác động dây chuyền theo
// State_Business_Kho_bai_Container_v1.docx mục 5 (Cross-Entity Trigger #2/#3/#7):
//   Gate-in Pass  -> YardVisit ARRIVED->IN_YARD + Movement(Gate-in)
//   Gate-in Fail  -> YardVisit ARRIVED->REJECTED + Event(Rejected)
//   Gate-out Fail -> Event(Dispute) — KHÔNG chặn YardVisit tiếp tục
//   Fail với fail_reason=physical_damage_minor/severe (bất kỳ loại nào)
//     -> Container MAINTENANCE/DAMAGED tương ứng
// ============================================================
@Injectable()
export class InspectionService {
  constructor(private readonly db: DatabaseService) {}

  async list(yardVisitId: string) {
    const result = await this.db.query(
      `SELECT ${INSPECTION_COLUMNS} FROM management.inspection WHERE yard_visit_id = $1 ORDER BY inspected_at DESC`,
      [yardVisitId],
    );
    return result.rows;
  }

  async create(yardVisitId: string, dto: CreateInspectionDto, inspectedBy: string) {
    const visitResult = await this.db.query<{ status: string; container_id: string }>(
      `SELECT yv.status, sc.container_id
       FROM management.yard_visit yv
       JOIN management.shipment_container sc ON sc.shipment_container_id = yv.shipment_container_id
       WHERE yv.yard_visit_id = $1`,
      [yardVisitId],
    );
    if (visitResult.rows.length === 0) throw new NotFoundException(`Yard Visit ${yardVisitId} không tồn tại`);
    const visit = visitResult.rows[0];

    if (dto.inspectionType === 'GateIn' && visit.status !== 'ARRIVED') {
      throw new ConflictException(`Yard Visit phải đang ARRIVED để tạo Inspection Gate-in (hiện tại: ${visit.status})`);
    }
    if (dto.inspectionType === 'GateOut' && visit.status !== 'STAGING') {
      throw new ConflictException(`Yard Visit phải đang STAGING để tạo Inspection Gate-out (hiện tại: ${visit.status})`);
    }

    // [MỚI] FR-06 — Gate-in Pass phải gán Warehouse còn dung lượng trống.
    if (dto.inspectionType === 'GateIn' && dto.result === 'Pass') {
      if (!dto.warehouseId) throw new BadRequestException('warehouseId là bắt buộc khi Inspection Gate-in Pass (FR-06)');
      const warehouse = await this.db.query<{ capacity: number; occupied: string }>(
        `SELECT w.capacity,
                (SELECT COUNT(*) FROM management.yard_visit yv
                 WHERE yv.current_warehouse_id = w.warehouse_id AND yv.status IN ('IN_YARD', 'STAGING')) AS occupied
         FROM management.warehouse w WHERE w.warehouse_id = $1`,
        [dto.warehouseId],
      );
      if (warehouse.rows.length === 0) throw new NotFoundException(`Warehouse ${dto.warehouseId} không tồn tại`);
      if (Number(warehouse.rows[0].occupied) >= warehouse.rows[0].capacity) {
        throw new ConflictException('Warehouse đã hết dung lượng trống — chọn Warehouse khác');
      }
    }

    const inspectionType = INSPECTION_TYPE_DB[dto.inspectionType];
    const inspection = await this.db.transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO management.inspection (yard_visit_id, inspection_type, seal_check, result, fail_reason, damage_notes, inspected_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${INSPECTION_COLUMNS}`,
        [yardVisitId, inspectionType, dto.sealCheck, dto.result, dto.failReason ?? null, dto.damageNotes ?? null, inspectedBy],
      );
      const created = result.rows[0];

      if (dto.inspectionType === 'GateIn' && dto.result === 'Pass') {
        await client.query(
          `UPDATE management.yard_visit SET status = 'IN_YARD', current_warehouse_id = $1, updated_at = CURRENT_TIMESTAMP WHERE yard_visit_id = $2`,
          [dto.warehouseId, yardVisitId],
        );
        await client.query(
          `INSERT INTO management.movement (yard_visit_id, movement_type, from_warehouse_id, to_warehouse_id, vehicle_id)
           VALUES ($1, 'Gate-in', NULL, $2, $3)`,
          [yardVisitId, dto.warehouseId, dto.vehicleId ?? null],
        );
      } else if (dto.inspectionType === 'GateIn' && dto.result === 'Fail') {
        await client.query(`UPDATE management.yard_visit SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE yard_visit_id = $1`, [
          yardVisitId,
        ]);
        await client.query(
          `INSERT INTO management.event (yard_visit_id, event_type, description) VALUES ($1, 'Rejected', $2)`,
          [yardVisitId, dto.damageNotes ?? 'Inspection Gate-in Fail'],
        );
      } else if (dto.inspectionType === 'GateOut' && dto.result === 'Fail') {
        await client.query(
          `INSERT INTO management.event (yard_visit_id, event_type, description) VALUES ($1, 'Dispute', $2)`,
          [yardVisitId, dto.damageNotes ?? 'Tranh chấp phát hiện lúc Gate-out (FR-09)'],
        );
      }

      if (dto.result === 'Fail' && (dto.failReason === 'physical_damage_minor' || dto.failReason === 'physical_damage_severe')) {
        const container = await client.query<{ status: string }>(
          `SELECT status FROM management.container WHERE container_id = $1`,
          [visit.container_id],
        );
        // DAMAGED là terminal (State Business 4.3) — không hạ cấp ngược về MAINTENANCE.
        if (container.rows.length > 0 && container.rows[0].status !== 'DAMAGED') {
          await client.query(`UPDATE management.container SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE container_id = $2`, [
            dto.failReason === 'physical_damage_severe' ? 'DAMAGED' : 'MAINTENANCE',
            visit.container_id,
          ]);
        }
      }

      return created;
    });

    return inspection;
  }
}
