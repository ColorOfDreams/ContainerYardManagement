import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsService } from './permissions.service';

@ApiTags('admin-permissions') @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}
  @Post() @RequirePermissions('permission:create') create(@Body() dto: CreatePermissionDto) { return this.permissionsService.create(dto); }
  @Get() @RequirePermissions('permission:read') findAll() { return this.permissionsService.findAll(); }
  @Get(':permissionId') @RequirePermissions('permission:read') findOne(@Param('permissionId') permissionId: string) { return this.permissionsService.findOne(permissionId); }
  @Patch(':permissionId') @RequirePermissions('permission:update') update(@Param('permissionId') permissionId: string, @Body() dto: UpdatePermissionDto) { return this.permissionsService.update(permissionId, dto); }
  @Delete(':permissionId') @RequirePermissions('permission:delete') remove(@Param('permissionId') permissionId: string) { return this.permissionsService.remove(permissionId); }
}
