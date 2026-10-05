import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_COLUMNS = 'user_id, email, display_name, is_active, created_at, updated_at';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateUserDto) {
    const roles = await this.resolveRoles(dto.roleCodes ?? []);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.db.transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO management.user (email, password_hash, display_name)
         VALUES ($1, $2, $3)
         RETURNING ${USER_COLUMNS}`,
        [dto.email.toLowerCase(), passwordHash, dto.displayName ?? null],
      );
      const user = result.rows[0];
      for (const role of roles) {
        await client.query(
          `INSERT INTO management.user_role (user_id, role_id) VALUES ($1, $2)`,
          [user.user_id, role.role_id],
        );
      }
      return { ...user, roles: roles.map(({ code, name }) => ({ code, name })) };
    });
  }

  async findAll(page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const offset = (safePage - 1) * safePageSize;

    const [dataResult, countResult] = await Promise.all([
      this.db.query(
        `SELECT ${USER_COLUMNS} FROM management.user ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [safePageSize, offset],
      ),
      this.db.query(`SELECT COUNT(*) FROM management.user`),
    ]);
    const total = Number(countResult.rows[0].count);
    const data = await this.attachRoles(dataResult.rows);

    return {
      data,
      meta: { page: safePage, pageSize: safePageSize, total, totalPages: Math.ceil(total / safePageSize) },
    };
  }

  async findOne(userId: string) {
    const result = await this.db.query(`SELECT ${USER_COLUMNS} FROM management.user WHERE user_id = $1`, [userId]);
    if (result.rows.length === 0) throw new NotFoundException('User không tồn tại');
    const [user] = await this.attachRoles(result.rows);
    return user;
  }

  async update(userId: string, dto: UpdateUserDto) {
    const current = await this.db.query(`SELECT ${USER_COLUMNS} FROM management.user WHERE user_id = $1`, [userId]);
    if (current.rows.length === 0) throw new NotFoundException('User không tồn tại');

    const roles = dto.roleCodes === undefined ? undefined : await this.resolveRoles(dto.roleCodes);
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : null;

    return this.db.transaction(async (client) => {
      const result = await client.query(
        `UPDATE management.user
         SET display_name = COALESCE($1, display_name),
             is_active = COALESCE($2, is_active),
             password_hash = COALESCE($3, password_hash)
         WHERE user_id = $4
         RETURNING ${USER_COLUMNS}`,
        [dto.displayName ?? null, dto.isActive ?? null, passwordHash, userId],
      );
      const user = result.rows[0];
      if (roles) {
        await client.query(`DELETE FROM management.user_role WHERE user_id = $1`, [userId]);
        for (const role of roles) {
          await client.query(
            `INSERT INTO management.user_role (user_id, role_id) VALUES ($1, $2)`,
            [userId, role.role_id],
          );
        }
        return { ...user, roles: roles.map(({ code, name }) => ({ code, name })) };
      }
      const [withRoles] = await this.attachRoles([user]);
      return withRoles;
    });
  }

  async remove(userId: string) {
    const result = await this.db.query(
      `UPDATE management.user SET is_active = false WHERE user_id = $1 RETURNING ${USER_COLUMNS}`,
      [userId],
    );
    if (result.rows.length === 0) throw new NotFoundException('User không tồn tại');
    const [user] = await this.attachRoles(result.rows);
    return user;
  }

  private async resolveRoles(roleCodes: string[]) {
    const uniqueCodes = [...new Set(roleCodes)];
    if (uniqueCodes.length === 0) return [];
    const result = await this.db.query<{ role_id: string; code: string; name: string }>(
      `SELECT role_id, code, name FROM management.role WHERE code = ANY($1)`,
      [uniqueCodes],
    );
    if (result.rows.length !== uniqueCodes.length) throw new BadRequestException('Có roleCode không tồn tại');
    return result.rows;
  }

  private async attachRoles(users: any[]) {
    if (users.length === 0) return [];
    const userIds = users.map((user) => user.user_id);
    const result = await this.db.query<{ user_id: string; code: string; name: string }>(
      `SELECT ur.user_id, r.code, r.name
       FROM management.user_role ur
       JOIN management.role r ON r.role_id = ur.role_id
       WHERE ur.user_id = ANY($1)`,
      [userIds],
    );
    const byUser = new Map<string, { code: string; name: string }[]>();
    for (const row of result.rows) {
      const list = byUser.get(row.user_id) ?? [];
      list.push({ code: row.code, name: row.name });
      byUser.set(row.user_id, list);
    }
    return users.map((user) => ({ ...user, roles: byUser.get(user.user_id) ?? [] }));
  }
}
