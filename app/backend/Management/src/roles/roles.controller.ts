import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('admin-roles') @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}
  @Post() @RequirePermissions('role:create') create(@Body() dto: CreateRoleDto) { return this.rolesService.create(dto); }
  @Get() @RequirePermissions('role:read') findAll() { return this.rolesService.findAll(); }
  @Get(':roleId') @RequirePermissions('role:read') findOne(@Param('roleId') roleId: string) { return this.rolesService.findOne(roleId); }
  @Patch(':roleId') @RequirePermissions('role:update') update(@Param('roleId') roleId: string, @Body() dto: UpdateRoleDto) { return this.rolesService.update(roleId, dto); }
  @Delete(':roleId') @RequirePermissions('role:delete') remove(@Param('roleId') roleId: string) { return this.rolesService.remove(roleId); }
}
