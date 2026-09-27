import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

// ============================================================
// EventService — FR-07. Event.resolutionStatus (Open/Resolved) là điều kiện
// guard cho YardVisit.stage() khi eventType=CustomsHold (xem
// YardVisitService.stage() và State Business Case 5, mục 3.5).
// ============================================================
@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filter: { yardVisitId?: string; eventType?: string; resolutionStatus?: string }) {
    return this.prisma.yardEvent.findMany({
      where: {
        ...(filter.yardVisitId && { yardVisitId: filter.yardVisitId }),
        ...(filter.eventType && { eventType: filter.eventType as never }),
        ...(filter.resolutionStatus && { resolutionStatus: filter.resolutionStatus as never }),
      },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async create(dto: CreateEventDto) {
    const visit = await this.prisma.yardVisit.findUnique({ where: { yardVisitId: dto.yardVisitId } });
    if (!visit) throw new NotFoundException(`Yard Visit ${dto.yardVisitId} không tồn tại`);
    return this.prisma.yardEvent.create({ data: { ...dto } });
  }

  async resolve(eventId: string, resolutionNote?: string) {
    const event = await this.prisma.yardEvent.findUnique({ where: { eventId } });
    if (!event) throw new NotFoundException(`Event ${eventId} không tồn tại`);
    if (event.resolutionStatus === 'Resolved') {
      throw new ConflictException('Event đã Resolved từ trước');
    }
    return this.prisma.yardEvent.update({
      where: { eventId },
      data: {
        resolutionStatus: 'Resolved',
        ...(resolutionNote && { description: `${event.description ?? ''}\n[Resolved] ${resolutionNote}`.trim() }),
      },
    });
  }
}
