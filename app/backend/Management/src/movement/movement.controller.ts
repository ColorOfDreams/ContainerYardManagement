import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { MovementService } from './movement.service';
import { RelocateMovementDto } from './dto/relocate-movement.dto';

@ApiTags('management-movement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('movements')
export class MovementController {
  constructor(private readonly movementService: MovementService) {}

  @Get()
  @RequirePermissions('movement:read')
  findAll(@Query('yard_visit_id') yardVisitId?: string, @Query('warehouse_id') warehouseId?: string) {
    return this.movementService.findAll({ yardVisitId, warehouseId });
  }

  @Post('relocate')
  @RequirePermissions('movement:create')
  relocate(@Body() dto: RelocateMovementDto) {
    return this.movementService.relocate(dto);
  }
}
