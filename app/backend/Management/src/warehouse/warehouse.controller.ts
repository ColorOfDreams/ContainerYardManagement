import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { WarehouseService } from './warehouse.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@ApiTags('management-warehouse')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  @RequirePermissions('warehouse:create')
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehouseService.create(dto);
  }

  @Get()
  @RequirePermissions('warehouse:read')
  findAll() {
    return this.warehouseService.findAll();
  }

  @Get(':warehouseId')
  @RequirePermissions('warehouse:read')
  findOne(@Param('warehouseId') warehouseId: string) {
    return this.warehouseService.findOne(warehouseId);
  }

  @Patch(':warehouseId')
  @RequirePermissions('warehouse:update')
  update(@Param('warehouseId') warehouseId: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehouseService.update(warehouseId, dto);
  }

  @Get(':warehouseId/occupancy')
  @RequirePermissions('warehouse:read')
  occupancy(@Param('warehouseId') warehouseId: string) {
    return this.warehouseService.occupancy(warehouseId);
  }
}
