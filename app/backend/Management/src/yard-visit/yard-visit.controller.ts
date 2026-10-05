import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { YardVisitService } from './yard-visit.service';
import { CreateYardVisitDto } from './dto/create-yard-visit.dto';
import { UpdateYardVisitDto } from './dto/update-yard-visit.dto';

@ApiTags('management-yard-visit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('yard-visits')
export class YardVisitController {
  constructor(private readonly yardVisitService: YardVisitService) {}

  @Post()
  @RequirePermissions('yardvisit:create')
  create(@Body() dto: CreateYardVisitDto) {
    return this.yardVisitService.create(dto);
  }

  @Get()
  @RequirePermissions('yardvisit:read')
  findAll() {
    return this.yardVisitService.findAll();
  }

  @Get(':yardVisitId')
  @RequirePermissions('yardvisit:read')
  findOne(@Param('yardVisitId') yardVisitId: string) {
    return this.yardVisitService.findOne(yardVisitId);
  }

  @Patch(':yardVisitId')
  @RequirePermissions('yardvisit:update')
  update(@Param('yardVisitId') yardVisitId: string, @Body() dto: UpdateYardVisitDto) {
    return this.yardVisitService.update(yardVisitId, dto);
  }

  @Post(':yardVisitId/cancel')
  @RequirePermissions('yardvisit:update')
  cancel(@Param('yardVisitId') yardVisitId: string, @Body('reason') reason: string) {
    return this.yardVisitService.cancel(yardVisitId, reason);
  }

  @Post(':yardVisitId/gate-in')
  @RequirePermissions('yardvisit:update')
  gateIn(@Param('yardVisitId') yardVisitId: string, @Body('ata') ata?: string) {
    return this.yardVisitService.gateIn(yardVisitId, ata);
  }

  @Post(':yardVisitId/stage')
  @RequirePermissions('yardvisit:update')
  stage(@Param('yardVisitId') yardVisitId: string) {
    return this.yardVisitService.stage(yardVisitId);
  }

  @Post(':yardVisitId/gate-out')
  @RequirePermissions('yardvisit:update')
  gateOut(
    @Param('yardVisitId') yardVisitId: string,
    @Body('atd') atd?: string,
    @Body('vehicleId') vehicleId?: string,
  ) {
    return this.yardVisitService.gateOut(yardVisitId, atd, vehicleId);
  }

  @Post(':yardVisitId/close')
  @RequirePermissions('yardvisit:update')
  close(@Param('yardVisitId') yardVisitId: string) {
    return this.yardVisitService.close(yardVisitId);
  }
}
