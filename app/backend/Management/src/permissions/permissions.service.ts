import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { BaseService } from '../common/base.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

const permissionView = { permissionId: true, code: true, name: true, description: true, createdAt: true, _count: { select: { roles: true } } };

@Injectable()
export class PermissionsService extends BaseService<PrismaService['permission']> {
  constructor(private readonly prisma: PrismaService) { super(prisma.permission); }
  async create(dto: CreatePermissionDto) {
    try { return await this.prisma.permission.create({ data: dto, select: permissionView }); }
    catch { throw new ConflictException('Permission code đã tồn tại'); }
  }
  findAll() { return this.page({ orderBy: { code: 'asc' } }); }
  async findOne(permissionId: string) { await this.requireOne({ permissionId }, 'Permission'); return this.prisma.permission.findUnique({ where: { permissionId }, select: permissionView }); }
  async update(permissionId: string, dto: UpdatePermissionDto) {
    await this.requireOne({ permissionId }, 'Permission');
    if (dto.code) throw new BadRequestException('Permission code là định danh bất biến');
    return this.prisma.permission.update({ where: { permissionId }, data: dto, select: permissionView });
  }
  async remove(permissionId: string) {
    const permission = await this.prisma.permission.findUnique({ where: { permissionId }, include: { _count: { select: { roles: true } } } });
    if (!permission) throw new BadRequestException('Permission không tồn tại');
    if (permission._count.roles > 0) throw new BadRequestException('Không thể xóa permission đang được gán');
    return this.prisma.permission.delete({ where: { permissionId }, select: permissionView });
  }
}
