import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { BaseService } from '../common/base.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const roleView = { roleId: true, code: true, name: true, description: true, isSystem: true, createdAt: true, updatedAt: true, permissions: { select: { permission: { select: { code: true, name: true } } } } };

@Injectable()
export class RolesService extends BaseService<PrismaService['role']> {
  constructor(private readonly prisma: PrismaService) { super(prisma.role); }
  async create(dto: CreateRoleDto) {
    const permissions = await this.resolvePermissions(dto.permissionCodes ?? []);
    try {
      return await this.prisma.role.create({ data: { code: dto.code, name: dto.name, description: dto.description, permissions: { create: permissions.map((permission) => ({ permissionId: permission.permissionId })) } }, select: roleView });
    } catch (error) { throw new ConflictException('Role code đã tồn tại'); }
  }
  findAll() { return this.page({ orderBy: { code: 'asc' } }); }
  async findOne(roleId: string) { await this.requireOne({ roleId }, 'Role'); return this.prisma.role.findUnique({ where: { roleId }, select: roleView }); }
  async update(roleId: string, dto: UpdateRoleDto) {
    const current = await this.prisma.role.findUnique({ where: { roleId } });
    if (!current) throw new BadRequestException('Role không tồn tại');
    if (current.isSystem && dto.code && dto.code !== current.code) throw new BadRequestException('Không thể đổi code của role hệ thống');
    const permissions = dto.permissionCodes === undefined ? undefined : await this.resolvePermissions(dto.permissionCodes);
    return this.prisma.role.update({ where: { roleId }, data: { name: dto.name, description: dto.description, ...(permissions && { permissions: { deleteMany: {}, create: permissions.map((permission) => ({ permissionId: permission.permissionId })) } }) }, select: roleView });
  }
  async remove(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { roleId }, include: { _count: { select: { users: true } } } });
    if (!role) throw new BadRequestException('Role không tồn tại');
    if (role.isSystem || role._count.users > 0) throw new BadRequestException('Không thể xóa role hệ thống hoặc role đang được gán');
    return this.prisma.role.delete({ where: { roleId }, select: roleView });
  }
  private async resolvePermissions(codes: string[]) {
    const uniqueCodes = [...new Set(codes)];
    const permissions = await this.prisma.permission.findMany({ where: { code: { in: uniqueCodes } }, select: { permissionId: true } });
    if (permissions.length !== uniqueCodes.length) throw new BadRequestException('Có permissionCode không tồn tại');
    return permissions;
  }
}
