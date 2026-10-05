import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { VehicleService } from './vehicle.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@ApiTags('management-vehicle')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('vehicles')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post()
  @RequirePermissions('vehicle:create')
  create(@Body() dto: CreateVehicleDto) {
    return this.vehicleService.create(dto);
  }

  @Get()
  @RequirePermissions('vehicle:read')
  findAll(@Query('status') status?: string) {
    return this.vehicleService.findAll(status);
  }

  @Get(':vehicleId')
  @RequirePermissions('vehicle:read')
  findOne(@Param('vehicleId') vehicleId: string) {
    return this.vehicleService.findOne(vehicleId);
  }

  @Patch(':vehicleId')
  @RequirePermissions('vehicle:update')
  update(@Param('vehicleId') vehicleId: string, @Body() dto: UpdateVehicleDto) {
    return this.vehicleService.update(vehicleId, dto);
  }

  @Post(':vehicleId/maintenance')
  @RequirePermissions('vehicle:update')
  maintenance(@Param('vehicleId') vehicleId: string) {
    return this.vehicleService.maintenance(vehicleId);
  }

  @Post(':vehicleId/available')
  @RequirePermissions('vehicle:update')
  available(@Param('vehicleId') vehicleId: string) {
    return this.vehicleService.available(vehicleId);
  }
}
