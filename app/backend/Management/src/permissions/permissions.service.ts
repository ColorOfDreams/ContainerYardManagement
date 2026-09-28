import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

const SELECT_WITH_ROLE_COUNT = `
  SELECT p.permission_id, p.code, p.name, p.description, p.created_at,
         COUNT(rp.role_id) AS role_count
  FROM management.permission p
  LEFT JOIN management.role_permission rp ON rp.permission_id = p.permission_id
`;

@Injectable()
export class PermissionsService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreatePermissionDto) {
    try {
      const result = await this.db.query(
        `INSERT INTO management.permission (code, name, description)
         VALUES ($1, $2, $3)
         RETURNING permission_id, code, name, description, created_at`,
        [dto.code, dto.name, dto.description ?? null],
      );
      return result.rows[0];
    } catch (error: any) {
      if (error.code === '23505') throw new ConflictException('Permission code đã tồn tại');
      throw error;
    }
  }

  async findAll(page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const offset = (safePage - 1) * safePageSize;

    const [dataResult, countResult] = await Promise.all([
      this.db.query(
        `${SELECT_WITH_ROLE_COUNT}
         GROUP BY p.permission_id
         ORDER BY p.code ASC
         LIMIT $1 OFFSET $2`,
        [safePageSize, offset],
      ),
      this.db.query(`SELECT COUNT(*) FROM management.permission`),
    ]);
    const total = Number(countResult.rows[0].count);

    return {
      data: dataResult.rows,
      meta: { page: safePage, pageSize: safePageSize, total, totalPages: Math.ceil(total / safePageSize) },
    };
  }

  async findOne(permissionId: string) {
    const result = await this.db.query(
      `${SELECT_WITH_ROLE_COUNT}
       WHERE p.permission_id = $1
       GROUP BY p.permission_id`,
      [permissionId],
    );
    if (result.rows.length === 0) throw new NotFoundException('Permission không tồn tại');
    return result.rows[0];
  }

  async update(permissionId: string, dto: UpdatePermissionDto) {
    if (dto.code) throw new BadRequestException('Permission code là định danh bất biến');
    const result = await this.db.query(
      `UPDATE management.permission
       SET name = COALESCE($1, name), description = COALESCE($2, description)
       WHERE permission_id = $3
       RETURNING permission_id, code, name, description, created_at`,
      [dto.name ?? null, dto.description ?? null, permissionId],
    );
    if (result.rows.length === 0) throw new NotFoundException('Permission không tồn tại');
    return result.rows[0];
  }

  async remove(permissionId: string) {
    const linked = await this.db.query(
      `SELECT COUNT(*) FROM management.role_permission WHERE permission_id = $1`,
      [permissionId],
    );
    if (Number(linked.rows[0].count) > 0) {
      throw new BadRequestException('Không thể xóa permission đang được gán');
    }
    const result = await this.db.query(
      `DELETE FROM management.permission WHERE permission_id = $1
       RETURNING permission_id, code, name, description, created_at`,
      [permissionId],
    );
    if (result.rows.length === 0) throw new BadRequestException('Permission không tồn tại');
    return result.rows[0];
  }
}
