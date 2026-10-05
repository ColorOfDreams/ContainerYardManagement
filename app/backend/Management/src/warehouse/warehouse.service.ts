import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

const WAREHOUSE_COLUMNS = 'warehouse_id, name, address, capacity, created_at, updated_at';

// ============================================================
// WarehouseService — quản lý Kho (master data). Thay cho Slot/Yard Optimize
// Service đã bỏ — vị trí container giờ theo dõi ở mức Warehouse, không có
// thuật toán tối ưu, không có state machine riêng (xem State_Business mục 6).
// ============================================================
@Injectable()
export class WarehouseService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateWarehouseDto) {
    const result = await this.db.query(
      `INSERT INTO management.warehouse (name, address, capacity)
       VALUES ($1, $2, $3)
       RETURNING ${WAREHOUSE_COLUMNS}`,
      [dto.name, dto.address ?? null, dto.capacity],
    );
    return result.rows[0];
  }

  async findAll() {
    const result = await this.db.query(`SELECT ${WAREHOUSE_COLUMNS} FROM management.warehouse ORDER BY name ASC`);
    return result.rows;
  }

  async findOne(warehouseId: string) {
    const result = await this.db.query(`SELECT ${WAREHOUSE_COLUMNS} FROM management.warehouse WHERE warehouse_id = $1`, [warehouseId]);
    if (result.rows.length === 0) throw new NotFoundException(`Warehouse ${warehouseId} không tồn tại`);
    return result.rows[0];
  }

  async update(warehouseId: string, dto: UpdateWarehouseDto) {
    await this.findOne(warehouseId);
    const result = await this.db.query(
      `UPDATE management.warehouse
       SET name = COALESCE($1, name), address = COALESCE($2, address), capacity = COALESCE($3, capacity),
           updated_at = CURRENT_TIMESTAMP
       WHERE warehouse_id = $4
       RETURNING ${WAREHOUSE_COLUMNS}`,
      [dto.name ?? null, dto.address ?? null, dto.capacity ?? null, warehouseId],
    );
    return result.rows[0];
  }

  // FR-11.2 — dung lượng hiện tại: số Yard Visit đang IN_YARD/STAGING tại kho này so với capacity.
  async occupancy(warehouseId: string) {
    const warehouse = await this.findOne(warehouseId);
    const result = await this.db.query<{ occupied: string }>(
      `SELECT COUNT(*) AS occupied FROM management.yard_visit
       WHERE current_warehouse_id = $1 AND status IN ('IN_YARD', 'STAGING')`,
      [warehouseId],
    );
    const occupied = Number(result.rows[0].occupied);
    return {
      warehouse_id: warehouse.warehouse_id,
      capacity: warehouse.capacity,
      occupied,
      occupancy_rate: warehouse.capacity > 0 ? occupied / warehouse.capacity : 0,
    };
  }
}
