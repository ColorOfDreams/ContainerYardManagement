import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { CreateShipmentContainerDto } from './dto/create-shipment-container.dto';
import { CreateCargoDto } from './dto/create-cargo.dto';

const TERMINAL_YARD_VISIT_STATUSES = ['CLOSED', 'REJECTED', 'CANCELLED'];

const SHIPMENT_COLUMNS =
  'shipment_id, contract_id, shipper, consignee, carrier, origin, loading_port, discharge_port, vessel, voyage, status, created_at, updated_at';
const SHIPMENT_CONTAINER_COLUMNS =
  'shipment_container_id, shipment_id, container_id, seal_number, seal_type, gross_weight_actual, created_at';
const CARGO_COLUMNS =
  'cargo_id, shipment_container_id, cargo_type, weight, volume, is_hazardous, temperature_min, temperature_max, humidity_min, humidity_max, special_handling, created_at';

// ============================================================
// ShipmentService — FR-03. Shipment.status là DERIVED (State Business 4.2):
// hệ thống KHÔNG cho client tự set — chỉ tự chuyển qua depart() (Planned->
// InTransit) và 2 transition derived khác (InTransit->Arrived, Arrived->
// Completed) được YardVisitService gọi khi container đầu tiên Gate-in /
// container cuối cùng CLOSED (xem yard-visit/yard-visit.service.ts).
// ============================================================
@Injectable()
export class ShipmentService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateShipmentDto) {
    const contract = await this.db.query(`SELECT status FROM management.contract WHERE contract_id = $1`, [dto.contractId]);
    if (contract.rows.length === 0) throw new NotFoundException(`Contract ${dto.contractId} không tồn tại`);
    if (contract.rows[0].status !== 'Active') {
      throw new ConflictException(`Contract phải đang Active mới tạo được Shipment (hiện tại: ${contract.rows[0].status})`);
    }
    const result = await this.db.query(
      `INSERT INTO management.shipment
         (contract_id, shipper, consignee, carrier, origin, loading_port, discharge_port, vessel, voyage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${SHIPMENT_COLUMNS}`,
      [
        dto.contractId,
        dto.shipper,
        dto.consignee,
        dto.carrier,
        dto.origin ?? null,
        dto.loadingPort ?? null,
        dto.dischargePort ?? null,
        dto.vessel ?? null,
        dto.voyage ?? null,
      ],
    );
    return result.rows[0];
  }

  async findAll() {
    const result = await this.db.query(`SELECT ${SHIPMENT_COLUMNS} FROM management.shipment ORDER BY created_at DESC`);
    return result.rows;
  }

  async findOne(shipmentId: string) {
    const result = await this.db.query(`SELECT ${SHIPMENT_COLUMNS} FROM management.shipment WHERE shipment_id = $1`, [shipmentId]);
    if (result.rows.length === 0) throw new NotFoundException(`Shipment ${shipmentId} không tồn tại`);
    return result.rows[0];
  }

  async update(shipmentId: string, dto: UpdateShipmentDto) {
    await this.findOne(shipmentId);
    const result = await this.db.query(
      `UPDATE management.shipment
       SET shipper = COALESCE($1, shipper),
           consignee = COALESCE($2, consignee),
           carrier = COALESCE($3, carrier),
           loading_port = COALESCE($4, loading_port),
           discharge_port = COALESCE($5, discharge_port),
           vessel = COALESCE($6, vessel),
           voyage = COALESCE($7, voyage),
           updated_at = CURRENT_TIMESTAMP
       WHERE shipment_id = $8
       RETURNING ${SHIPMENT_COLUMNS}`,
      [
        dto.shipper ?? null,
        dto.consignee ?? null,
        dto.carrier ?? null,
        dto.loadingPort ?? null,
        dto.dischargePort ?? null,
        dto.vessel ?? null,
        dto.voyage ?? null,
        shipmentId,
      ],
    );
    return result.rows[0];
  }

  async depart(shipmentId: string) {
    const shipment = await this.findOne(shipmentId);
    if (shipment.status !== 'Planned') {
      throw new ConflictException(`Chỉ Shipment đang Planned mới depart được (hiện tại: ${shipment.status})`);
    }
    const result = await this.db.query(
      `UPDATE management.shipment SET status = 'In Transit', updated_at = CURRENT_TIMESTAMP
       WHERE shipment_id = $1 RETURNING ${SHIPMENT_COLUMNS}`,
      [shipmentId],
    );
    return result.rows[0];
  }

  async listContainers(shipmentId: string) {
    const result = await this.db.query(
      `SELECT ${SHIPMENT_CONTAINER_COLUMNS} FROM management.shipment_container WHERE shipment_id = $1 ORDER BY created_at DESC`,
      [shipmentId],
    );
    return result.rows;
  }

  async addContainer(shipmentId: string, dto: CreateShipmentContainerDto) {
    await this.findOne(shipmentId);
    const container = await this.db.query(`SELECT container_id FROM management.container WHERE container_id = $1`, [dto.containerId]);
    if (container.rows.length === 0) throw new NotFoundException(`Container ${dto.containerId} không tồn tại`);

    const openVisit = await this.db.query(
      `SELECT yv.yard_visit_id
       FROM management.yard_visit yv
       JOIN management.shipment_container sc ON sc.shipment_container_id = yv.shipment_container_id
       WHERE sc.container_id = $1 AND yv.status NOT IN (${TERMINAL_YARD_VISIT_STATUSES.map((_, i) => `$${i + 2}`).join(', ')})
       LIMIT 1`,
      [dto.containerId, ...TERMINAL_YARD_VISIT_STATUSES],
    );
    if (openVisit.rows.length > 0) {
      throw new ConflictException('Container đang có Yard Visit chưa Closed/Rejected/Cancelled ở Shipment khác');
    }

    const result = await this.db.query(
      `INSERT INTO management.shipment_container (shipment_id, container_id, seal_number, seal_type, gross_weight_actual)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SHIPMENT_CONTAINER_COLUMNS}`,
      [shipmentId, dto.containerId, dto.sealNumber, dto.sealType, dto.grossWeightActual ?? null],
    );
    return result.rows[0];
  }

  async findShipmentContainer(shipmentContainerId: string) {
    const result = await this.db.query(
      `SELECT ${SHIPMENT_CONTAINER_COLUMNS} FROM management.shipment_container WHERE shipment_container_id = $1`,
      [shipmentContainerId],
    );
    if (result.rows.length === 0) throw new NotFoundException(`Shipment_Container ${shipmentContainerId} không tồn tại`);
    return result.rows[0];
  }

  async listCargo(shipmentContainerId: string) {
    const result = await this.db.query(
      `SELECT ${CARGO_COLUMNS} FROM management.cargo WHERE shipment_container_id = $1 ORDER BY created_at DESC`,
      [shipmentContainerId],
    );
    return result.rows;
  }

  async addCargo(shipmentContainerId: string, dto: CreateCargoDto) {
    await this.findShipmentContainer(shipmentContainerId);
    const result = await this.db.query(
      `INSERT INTO management.cargo
         (shipment_container_id, cargo_type, weight, volume, is_hazardous, temperature_min, temperature_max, humidity_min, humidity_max, special_handling)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${CARGO_COLUMNS}`,
      [
        shipmentContainerId,
        dto.cargoType,
        dto.weight,
        dto.volume ?? null,
        dto.isHazardous ?? false,
        dto.temperatureMin ?? null,
        dto.temperatureMax ?? null,
        dto.humidityMin ?? null,
        dto.humidityMax ?? null,
        dto.specialHandling ?? null,
      ],
    );
    return result.rows[0];
  }
}
