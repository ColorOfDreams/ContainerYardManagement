import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RelocateMovementDto } from './dto/relocate-movement.dto';

const MOVEMENT_COLUMNS = 'movement_id, yard_visit_id, movement_type, from_warehouse_id, to_warehouse_id, vehicle_id, reason, moved_at, operator_id';

// ============================================================
// MovementService — FR-06/07/08/09. Lịch sử di chuyển nội bãi.
//
// relocate(): client tự chọn Warehouse mới (toWarehouseId) — không dùng
// thuật toán scoring toàn bãi (đã đơn giản hóa so với Slot Allocation cũ,
// xem State Business Case 3, mục 3.3).
// ============================================================
@Injectable()
export class MovementService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(filter: { yardVisitId?: string; warehouseId?: string }) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter.yardVisitId) {
      params.push(filter.yardVisitId);
      conditions.push(`yard_visit_id = $${params.length}`);
    }
    if (filter.warehouseId) {
      params.push(filter.warehouseId);
      conditions.push(`(from_warehouse_id = $${params.length} OR to_warehouse_id = $${params.length})`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.db.query(
      `SELECT ${MOVEMENT_COLUMNS} FROM management.movement ${where} ORDER BY moved_at DESC`,
      params,
    );
    return result.rows;
  }

  async relocate(dto: RelocateMovementDto) {
    const visit = await this.db.query<{ status: string; current_warehouse_id: string | null }>(
      `SELECT status, current_warehouse_id FROM management.yard_visit WHERE yard_visit_id = $1`,
      [dto.yardVisitId],
    );
    if (visit.rows.length === 0) throw new NotFoundException(`Yard Visit ${dto.yardVisitId} không tồn tại`);
    if (visit.rows[0].status !== 'IN_YARD') {
      throw new ConflictException(`Chỉ Relocate được khi Yard Visit đang IN_YARD (hiện tại: ${visit.rows[0].status})`);
    }

    const warehouse = await this.db.query<{ capacity: number; occupied: string }>(
      `SELECT w.capacity,
              (SELECT COUNT(*) FROM management.yard_visit yv
               WHERE yv.current_warehouse_id = w.warehouse_id AND yv.status IN ('IN_YARD', 'STAGING')) AS occupied
       FROM management.warehouse w WHERE w.warehouse_id = $1`,
      [dto.toWarehouseId],
    );
    if (warehouse.rows.length === 0) throw new NotFoundException(`Warehouse ${dto.toWarehouseId} không tồn tại`);
    if (Number(warehouse.rows[0].occupied) >= warehouse.rows[0].capacity) {
      throw new ConflictException('Warehouse đích đã hết dung lượng trống — chọn kho khác');
    }

    return this.db.transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO management.movement (yard_visit_id, movement_type, from_warehouse_id, to_warehouse_id, vehicle_id, reason)
         VALUES ($1, 'Relocation', $2, $3, $4, $5)
         RETURNING ${MOVEMENT_COLUMNS}`,
        [dto.yardVisitId, visit.rows[0].current_warehouse_id, dto.toWarehouseId, dto.vehicleId ?? null, dto.reason],
      );
      await client.query(`UPDATE management.yard_visit SET current_warehouse_id = $1, updated_at = CURRENT_TIMESTAMP WHERE yard_visit_id = $2`, [
        dto.toWarehouseId,
        dto.yardVisitId,
      ]);
      return result.rows[0];
    });
  }
}
