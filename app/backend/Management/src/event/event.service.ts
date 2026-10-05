import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateEventDto } from './dto/create-event.dto';

const EVENT_COLUMNS = 'event_id, yard_visit_id, event_type, description, requested_by, occurred_at, resolution_status';

// DTO dùng tên enum liền không dấu (khớp quy ước Prisma cũ); DB lưu đúng
// theo SRS (có khoảng trắng) — cần map tay vì không còn Prisma @map nữa.
const EVENT_TYPE_DB: Record<string, string> = {
  CustomsHold: 'Customs Hold',
  Rejected: 'Rejected',
  Dispute: 'Dispute',
  DamageDuringMovement: 'Damage During Movement',
  OwnerRequest: 'Owner Request',
};

// ============================================================
// EventService — FR-07. Event.resolutionStatus (Open/Resolved) là điều kiện
// guard cho YardVisit.stage() khi eventType=CustomsHold (xem
// YardVisitService.stage() và State Business Case 5, mục 3.5).
// ============================================================
@Injectable()
export class EventService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(filter: { yardVisitId?: string; eventType?: string; resolutionStatus?: string }) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter.yardVisitId) {
      params.push(filter.yardVisitId);
      conditions.push(`yard_visit_id = $${params.length}`);
    }
    if (filter.eventType) {
      params.push(EVENT_TYPE_DB[filter.eventType] ?? filter.eventType);
      conditions.push(`event_type = $${params.length}`);
    }
    if (filter.resolutionStatus) {
      params.push(filter.resolutionStatus);
      conditions.push(`resolution_status = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.db.query(
      `SELECT ${EVENT_COLUMNS} FROM management.event ${where} ORDER BY occurred_at DESC`,
      params,
    );
    return result.rows;
  }

  async create(dto: CreateEventDto) {
    const visit = await this.db.query(`SELECT 1 FROM management.yard_visit WHERE yard_visit_id = $1`, [dto.yardVisitId]);
    if (visit.rows.length === 0) throw new NotFoundException(`Yard Visit ${dto.yardVisitId} không tồn tại`);
    const result = await this.db.query(
      `INSERT INTO management.event (yard_visit_id, event_type, description, requested_by)
       VALUES ($1, $2, $3, $4)
       RETURNING ${EVENT_COLUMNS}`,
      [dto.yardVisitId, EVENT_TYPE_DB[dto.eventType] ?? dto.eventType, dto.description ?? null, dto.requestedBy ?? null],
    );
    return result.rows[0];
  }

  async resolve(eventId: string, resolutionNote?: string) {
    const current = await this.db.query<{ resolution_status: string; description: string | null }>(
      `SELECT resolution_status, description FROM management.event WHERE event_id = $1`,
      [eventId],
    );
    if (current.rows.length === 0) throw new NotFoundException(`Event ${eventId} không tồn tại`);
    if (current.rows[0].resolution_status === 'Resolved') {
      throw new ConflictException('Event đã Resolved từ trước');
    }
    const description = resolutionNote
      ? `${current.rows[0].description ?? ''}\n[Resolved] ${resolutionNote}`.trim()
      : current.rows[0].description;
    const result = await this.db.query(
      `UPDATE management.event SET resolution_status = 'Resolved', description = $1 WHERE event_id = $2 RETURNING ${EVENT_COLUMNS}`,
      [description, eventId],
    );
    return result.rows[0];
  }
}
