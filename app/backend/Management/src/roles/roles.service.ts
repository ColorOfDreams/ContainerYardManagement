import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const ROLE_COLUMNS = 'role_id, code, name, description, is_system, created_at, updated_at';

@Injectable()
export class RolesService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateRoleDto) {
    const permissions = await this.resolvePermissions(dto.permissionCodes ?? []);
    try {
      return await this.db.transaction(async (client) => {
        const result = await client.query(
          `INSERT INTO management.role (code, name, description)
           VALUES ($1, $2, $3)
           RETURNING ${ROLE_COLUMNS}`,
          [dto.code, dto.name, dto.description ?? null],
        );
        const role = result.rows[0];
        for (const permission of permissions) {
          await client.query(
            `INSERT INTO management.role_permission (role_id, permission_id) VALUES ($1, $2)`,
            [role.role_id, permission.permission_id],
          );
        }
        return { ...role, permissions: permissions.map(({ code, name }) => ({ code, name })) };
      });
    } catch (error: any) {
      if (error.code === '23505') throw new ConflictException('Role code đã tồn tại');
      throw error;
    }
  }

  async findAll(page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const offset = (safePage - 1) * safePageSize;

    const [dataResult, countResult] = await Promise.all([
      this.db.query(
        `SELECT ${ROLE_COLUMNS} FROM management.role ORDER BY code ASC LIMIT $1 OFFSET $2`,
        [safePageSize, offset],
      ),
      this.db.query(`SELECT COUNT(*) FROM management.role`),
    ]);
    const total = Number(countResult.rows[0].count);
    const data = await this.attachPermissions(dataResult.rows);

    return {
      data,
      meta: { page: safePage, pageSize: safePageSize, total, totalPages: Math.ceil(total / safePageSize) },
    };
  }

  async findOne(roleId: string) {
    const result = await this.db.query(`SELECT ${ROLE_COLUMNS} FROM management.role WHERE role_id = $1`, [roleId]);
    if (result.rows.length === 0) throw new NotFoundException('Role không tồn tại');
    const [role] = await this.attachPermissions(result.rows);
    return role;
  }

  async update(roleId: string, dto: UpdateRoleDto) {
    const current = await this.db.query(`SELECT ${ROLE_COLUMNS} FROM management.role WHERE role_id = $1`, [roleId]);
    if (current.rows.length === 0) throw new BadRequestException('Role không tồn tại');
    if (current.rows[0].is_system && dto.code && dto.code !== current.rows[0].code) {
      throw new BadRequestException('Không thể đổi code của role hệ thống');
    }
    const permissions = dto.permissionCodes === undefined ? undefined : await this.resolvePermissions(dto.permissionCodes);

    return this.db.transaction(async (client) => {
      const result = await client.query(
        `UPDATE management.role
         SET name = COALESCE($1, name), description = COALESCE($2, description)
         WHERE role_id = $3
         RETURNING ${ROLE_COLUMNS}`,
        [dto.name ?? null, dto.description ?? null, roleId],
      );
      const role = result.rows[0];
      if (permissions) {
        await client.query(`DELETE FROM management.role_permission WHERE role_id = $1`, [roleId]);
        for (const permission of permissions) {
          await client.query(
            `INSERT INTO management.role_permission (role_id, permission_id) VALUES ($1, $2)`,
            [roleId, permission.permission_id],
          );
        }
        return { ...role, permissions: permissions.map(({ code, name }) => ({ code, name })) };
      }
      const [withPermissions] = await this.attachPermissions([role]);
      return withPermissions;
    });
  }

  async remove(roleId: string) {
    const result = await this.db.query(
      `SELECT r.role_id, r.code, r.name, r.description, r.is_system, r.created_at, r.updated_at,
              (SELECT COUNT(*) FROM management.user_role ur WHERE ur.role_id = r.role_id) AS user_count
       FROM management.role r
       WHERE r.role_id = $1`,
      [roleId],
    );
    if (result.rows.length === 0) throw new BadRequestException('Role không tồn tại');
    const role = result.rows[0];
    if (role.is_system || Number(role.user_count) > 0) {
      throw new BadRequestException('Không thể xóa role hệ thống hoặc role đang được gán');
    }
    const [withPermissions] = await this.attachPermissions([role]);
    await this.db.query(`DELETE FROM management.role WHERE role_id = $1`, [roleId]);
    return withPermissions;
  }

  private async resolvePermissions(codes: string[]) {
    const uniqueCodes = [...new Set(codes)];
    if (uniqueCodes.length === 0) return [];
    const result = await this.db.query<{ permission_id: string; code: string; name: string }>(
      `SELECT permission_id, code, name FROM management.permission WHERE code = ANY($1)`,
      [uniqueCodes],
    );
    if (result.rows.length !== uniqueCodes.length) throw new BadRequestException('Có permissionCode không tồn tại');
    return result.rows;
  }

  private async attachPermissions(roles: any[]) {
    if (roles.length === 0) return [];
    const roleIds = roles.map((role) => role.role_id);
    const result = await this.db.query<{ role_id: string; code: string; name: string }>(
      `SELECT rp.role_id, p.code, p.name
       FROM management.role_permission rp
       JOIN management.permission p ON p.permission_id = rp.permission_id
       WHERE rp.role_id = ANY($1)`,
      [roleIds],
    );
    const byRole = new Map<string, { code: string; name: string }[]>();
    for (const row of result.rows) {
      const list = byRole.get(row.role_id) ?? [];
      list.push({ code: row.code, name: row.name });
      byRole.set(row.role_id, list);
    }
    return roles.map((role) => ({ ...role, permissions: byRole.get(role.role_id) ?? [] }));
  }
}
