import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { BaseService } from '../common/base.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const publicUser = { userId: true, email: true, displayName: true, isActive: true, createdAt: true, updatedAt: true, roles: { select: { role: { select: { code: true, name: true } } } } };

@Injectable()
export class UsersService extends BaseService<PrismaService['user']> {
  constructor(private readonly prisma: PrismaService) { super(prisma.user); }
  async create(dto: CreateUserDto) {
    const roles = await this.resolveRoles(dto.roleCodes ?? []);
    return this.prisma.user.create({ data: { email: dto.email.toLowerCase(), passwordHash: await bcrypt.hash(dto.password, 12), displayName: dto.displayName, roles: { create: roles.map((role) => ({ roleId: role.roleId })) } }, select: publicUser });
  }
  findAll() { return this.page({ orderBy: { createdAt: 'desc' } }); }
  async findOne(userId: string) { await this.requireOne({ userId }, 'User'); return this.prisma.user.findUnique({ where: { userId }, select: publicUser }); }
  async update(userId: string, dto: UpdateUserDto) {
    await this.requireOne({ userId }, 'User');
    const roles = dto.roleCodes === undefined ? undefined : await this.resolveRoles(dto.roleCodes);
    return this.prisma.user.update({ where: { userId }, data: { displayName: dto.displayName, isActive: dto.isActive, ...(dto.password && { passwordHash: await bcrypt.hash(dto.password, 12) }), ...(roles && { roles: { deleteMany: {}, create: roles.map((role) => ({ roleId: role.roleId })) } }) }, select: publicUser });
  }
  async remove(userId: string) { await this.requireOne({ userId }, 'User'); return this.prisma.user.update({ where: { userId }, data: { isActive: false }, select: publicUser }); }
  private async resolveRoles(roleCodes: string[]) {
    const uniqueCodes = [...new Set(roleCodes)];
    const roles = await this.prisma.role.findMany({ where: { code: { in: uniqueCodes } }, select: { roleId: true } });
    if (roles.length !== uniqueCodes.length) throw new BadRequestException('Có roleCode không tồn tại');
    return roles;
  }
}
