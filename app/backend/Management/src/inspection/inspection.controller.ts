import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { InspectionService } from './inspection.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';

@ApiTags('management-inspection')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('yard-visits/:yardVisitId/inspections')
export class InspectionController {
  constructor(private readonly inspectionService: InspectionService) {}

  @Get()
  @RequirePermissions('inspection:read')
  list(@Param('yardVisitId') yardVisitId: string) {
    return this.inspectionService.list(yardVisitId);
  }

  @Post()
  @RequirePermissions('inspection:create')
  create(
    @Param('yardVisitId') yardVisitId: string,
    @Body() dto: CreateInspectionDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.inspectionService.create(yardVisitId, dto, request.user.userId);
  }
}
