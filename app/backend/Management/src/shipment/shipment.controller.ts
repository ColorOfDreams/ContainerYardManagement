import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ShipmentService } from './shipment.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { CreateShipmentContainerDto } from './dto/create-shipment-container.dto';

@ApiTags('management-shipment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('shipments')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post()
  @RequirePermissions('shipment:create')
  create(@Body() dto: CreateShipmentDto) {
    return this.shipmentService.create(dto);
  }

  @Get()
  @RequirePermissions('shipment:read')
  findAll() {
    return this.shipmentService.findAll();
  }

  @Get(':shipmentId')
  @RequirePermissions('shipment:read')
  findOne(@Param('shipmentId') shipmentId: string) {
    return this.shipmentService.findOne(shipmentId);
  }

  @Patch(':shipmentId')
  @RequirePermissions('shipment:update')
  update(@Param('shipmentId') shipmentId: string, @Body() dto: UpdateShipmentDto) {
    return this.shipmentService.update(shipmentId, dto);
  }

  @Post(':shipmentId/depart')
  @RequirePermissions('shipment:update')
  depart(@Param('shipmentId') shipmentId: string) {
    return this.shipmentService.depart(shipmentId);
  }

  @Get(':shipmentId/containers')
  @RequirePermissions('shipment:read')
  listContainers(@Param('shipmentId') shipmentId: string) {
    return this.shipmentService.listContainers(shipmentId);
  }

  @Post(':shipmentId/containers')
  @RequirePermissions('shipment:update')
  addContainer(@Param('shipmentId') shipmentId: string, @Body() dto: CreateShipmentContainerDto) {
    return this.shipmentService.addContainer(shipmentId, dto);
  }
}
