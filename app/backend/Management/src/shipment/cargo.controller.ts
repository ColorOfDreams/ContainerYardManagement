import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ShipmentService } from './shipment.service';
import { CreateCargoDto } from './dto/create-cargo.dto';

// Route gốc khác Shipment ("/shipment-containers/...") nên tách Controller
// riêng, nhưng dùng chung ShipmentService — FR-03.3.
@ApiTags('management-shipment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('shipment-containers')
export class CargoController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Get(':shipmentContainerId/cargo')
  @RequirePermissions('shipment:read')
  list(@Param('shipmentContainerId') shipmentContainerId: string) {
    return this.shipmentService.listCargo(shipmentContainerId);
  }

  @Post(':shipmentContainerId/cargo')
  @RequirePermissions('shipment:update')
  create(@Param('shipmentContainerId') shipmentContainerId: string, @Body() dto: CreateCargoDto) {
    return this.shipmentService.addCargo(shipmentContainerId, dto);
  }
}
