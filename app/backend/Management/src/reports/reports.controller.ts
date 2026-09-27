import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ReportsService } from './reports.service';

@ApiTags('management-report')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overdue-containers')
  @RequirePermissions('report:read')
  overdueContainers() {
    return this.reportsService.overdueContainers();
  }

  @Get('yard-visit-schedule')
  @RequirePermissions('report:read')
  yardVisitSchedule(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.yardVisitSchedule(from, to);
  }

  @Get('revenue')
  @RequirePermissions('report:read')
  revenue(@Query('contract_id') contractId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.revenue(contractId, from, to);
  }
}
