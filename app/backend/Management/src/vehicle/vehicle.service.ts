import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

const VEHICLE_COLUMNS = 'vehicle_id, plate_number, vehicle_type, capacity, status, created_at, updated_at';

// ============================================================
// VehicleService — quản lý Phương tiện vận tải. State machine đơn giản
// theo State_Business_Kho_bai_Container_v1.docx mục 4.4:
//   AVAILABLE <-> IN_USE, AVAILABLE/IN_USE -> MAINTENANCE -> AVAILABLE.
// IN_USE được set khi gắn vào 1 Movement (FR-07) — xem MovementService.
// ============================================================
@Injectable()
export class VehicleService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateVehicleDto) {
    const existing = await this.db.query(`SELECT vehicle_id FROM management.vehicle WHERE plate_number = $1`, [dto.plateNumber]);
    if (existing.rows.length > 0) throw new ConflictException(`plate_number ${dto.plateNumber} đã tồn tại`);

    const result = await this.db.query(
      `INSERT INTO management.vehicle (plate_number, vehicle_type, capacity)
       VALUES ($1, $2, $3)
       RETURNING ${VEHICLE_COLUMNS}`,
      [dto.plateNumber, dto.vehicleType, dto.capacity ?? null],
    );
    return result.rows[0];
  }

  async findAll(status?: string) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.db.query(`SELECT ${VEHICLE_COLUMNS} FROM management.vehicle ${where} ORDER BY plate_number ASC`, params);
    return result.rows;
  }

  async findOne(vehicleId: string) {
    const result = await this.db.query(`SELECT ${VEHICLE_COLUMNS} FROM management.vehicle WHERE vehicle_id = $1`, [vehicleId]);
    if (result.rows.length === 0) throw new NotFoundException(`Vehicle ${vehicleId} không tồn tại`);
    return result.rows[0];
  }

  async update(vehicleId: string, dto: UpdateVehicleDto) {
    await this.findOne(vehicleId);
    const result = await this.db.query(
      `UPDATE management.vehicle
       SET vehicle_type = COALESCE($1, vehicle_type), capacity = COALESCE($2, capacity), updated_at = CURRENT_TIMESTAMP
       WHERE vehicle_id = $3
       RETURNING ${VEHICLE_COLUMNS}`,
      [dto.vehicleType ?? null, dto.capacity ?? null, vehicleId],
    );
    return result.rows[0];
  }

  async maintenance(vehicleId: string) {
    const vehicle = await this.findOne(vehicleId);
    if (vehicle.status === 'MAINTENANCE') {
      throw new ConflictException('Vehicle đã ở trạng thái MAINTENANCE');
    }
    return this.setStatus(vehicleId, 'MAINTENANCE');
  }

  async available(vehicleId: string) {
    const vehicle = await this.findOne(vehicleId);
    if (vehicle.status !== 'MAINTENANCE') {
      throw new ConflictException(`Chỉ Vehicle đang MAINTENANCE mới chuyển AVAILABLE được (hiện tại: ${vehicle.status})`);
    }
    return this.setStatus(vehicleId, 'AVAILABLE');
  }

  private async setStatus(vehicleId: string, status: string) {
    const result = await this.db.query(
      `UPDATE management.vehicle SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE vehicle_id = $2 RETURNING ${VEHICLE_COLUMNS}`,
      [status, vehicleId],
    );
    return result.rows[0];
  }
}
