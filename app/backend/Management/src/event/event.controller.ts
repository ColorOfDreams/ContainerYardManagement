import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';

@ApiTags('management-event')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  @RequirePermissions('event:read')
  findAll(
    @Query('yard_visit_id') yardVisitId?: string,
    @Query('event_type') eventType?: string,
    @Query('resolution_status') resolutionStatus?: string,
  ) {
    return this.eventService.findAll({ yardVisitId, eventType, resolutionStatus });
  }

  @Post()
  @RequirePermissions('event:create')
  create(@Body() dto: CreateEventDto) {
    return this.eventService.create(dto);
  }

  @Post(':eventId/resolve')
  @RequirePermissions('event:resolve')
  resolve(@Param('eventId') eventId: string, @Body('resolutionNote') resolutionNote?: string) {
    return this.eventService.resolve(eventId, resolutionNote);
  }
}
