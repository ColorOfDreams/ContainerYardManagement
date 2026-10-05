import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';

const CONTAINER_COLUMNS =
  'container_id, container_code, container_type, size_type_code, tare_weight, max_gross_weight, max_payload, capacity, status, created_at, updated_at';

// ============================================================
// ContainerService — FR-02. State machine container (tài sản), theo đúng
// State_Business_Kho_bai_Container_v1.docx mục 4.3:
//   AVAILABLE <-> MAINTENANCE, AVAILABLE|MAINTENANCE -> DAMAGED (terminal).
// ============================================================
@Injectable()
export class ContainerService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateContainerDto) {
    const existing = await this.db.query(
      `SELECT container_id FROM management.container WHERE container_code = $1`,
      [dto.containerCode],
    );
    if (existing.rows.length > 0) throw new ConflictException(`container_code ${dto.containerCode} đã tồn tại`);

    const result = await this.db.query(
      `INSERT INTO management.container
         (container_code, container_type, size_type_code, tare_weight, max_gross_weight, max_payload, capacity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${CONTAINER_COLUMNS}`,
      [
        dto.containerCode,
        dto.containerType,
        dto.sizeTypeCode,
        dto.tareWeight ?? null,
        dto.maxGrossWeight ?? null,
        dto.maxPayload ?? null,
        dto.capacity ?? null,
      ],
    );
    return result.rows[0];
  }

  async findAll() {
    const result = await this.db.query(`SELECT ${CONTAINER_COLUMNS} FROM management.container ORDER BY created_at DESC`);
    return result.rows;
  }

  async findOne(containerId: string) {
    const result = await this.db.query(
      `SELECT ${CONTAINER_COLUMNS} FROM management.container WHERE container_id = $1`,
      [containerId],
    );
    if (result.rows.length === 0) throw new NotFoundException(`Container ${containerId} không tồn tại`);
    return result.rows[0];
  }

  async update(containerId: string, dto: UpdateContainerDto) {
    await this.findOne(containerId);
    const result = await this.db.query(
      `UPDATE management.container
       SET container_type = COALESCE($1, container_type),
           size_type_code = COALESCE($2, size_type_code),
           tare_weight = COALESCE($3, tare_weight),
           max_gross_weight = COALESCE($4, max_gross_weight),
           max_payload = COALESCE($5, max_payload),
           capacity = COALESCE($6, capacity),
           updated_at = CURRENT_TIMESTAMP
       WHERE container_id = $7
       RETURNING ${CONTAINER_COLUMNS}`,
      [
        dto.containerType ?? null,
        dto.sizeTypeCode ?? null,
        dto.tareWeight ?? null,
        dto.maxGrossWeight ?? null,
        dto.maxPayload ?? null,
        dto.capacity ?? null,
        containerId,
      ],
    );
    return result.rows[0];
  }

  async maintenance(containerId: string) {
    const container = await this.findOne(containerId);
    if (container.status !== 'AVAILABLE') {
      throw new ConflictException(`Chỉ Container đang AVAILABLE mới chuyển MAINTENANCE được (hiện tại: ${container.status})`);
    }
    return this.setStatus(containerId, 'MAINTENANCE');
  }

  async available(containerId: string) {
    const container = await this.findOne(containerId);
    if (container.status === 'DAMAGED') {
      throw new ConflictException('Container đang DAMAGED — không thể chuyển thẳng sang AVAILABLE (terminal state)');
    }
    if (container.status !== 'MAINTENANCE') {
      throw new ConflictException(`Chỉ Container đang MAINTENANCE mới chuyển AVAILABLE được (hiện tại: ${container.status})`);
    }
    return this.setStatus(containerId, 'AVAILABLE');
  }

  async damage(containerId: string) {
    const container = await this.findOne(containerId);
    if (container.status === 'DAMAGED') {
      throw new ConflictException('Container đã ở trạng thái DAMAGED');
    }
    // AVAILABLE hoặc MAINTENANCE đều được phép -> DAMAGED (terminal), áp dụng
    // cho cả hư hỏng phát hiện lúc Gate-in lẫn Gate-out (State Business 4.3).
    return this.setStatus(containerId, 'DAMAGED');
  }

  private async setStatus(containerId: string, status: string) {
    const result = await this.db.query(
      `UPDATE management.container SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE container_id = $2 RETURNING ${CONTAINER_COLUMNS}`,
      [status, containerId],
    );
    return result.rows[0];
  }
}
