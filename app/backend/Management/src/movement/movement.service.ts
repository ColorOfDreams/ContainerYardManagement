import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RelocateMovementDto } from './dto/relocate-movement.dto';

// ============================================================
// MovementService — FR-06/07/08/09. Lịch sử di chuyển nội bãi.
//
// relocate(): giản lược có chủ đích — chỉ ghi nhận Movement type=Relocation
// (State Business Case 3, mục 3.3 yêu cầu thuật toán scoring toàn bãi khi
// chọn slot mới, nhưng đó là trách nhiệm Yard Optimize Service, chưa triển
// khai). from_slot_id/to_slot_id luôn null cho tới khi service đó có.
// ============================================================
@Injectable()
export class MovementService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filter: { yardVisitId?: string; slotId?: string }) {
    return this.prisma.movement.findMany({
      where: {
        ...(filter.yardVisitId && { yardVisitId: filter.yardVisitId }),
        ...(filter.slotId && { OR: [{ fromSlotId: filter.slotId }, { toSlotId: filter.slotId }] }),
      },
      orderBy: { movedAt: 'desc' },
    });
  }

  async relocate(dto: RelocateMovementDto) {
    const visit = await this.prisma.yardVisit.findUnique({ where: { yardVisitId: dto.yardVisitId } });
    if (!visit) throw new NotFoundException(`Yard Visit ${dto.yardVisitId} không tồn tại`);
    if (visit.status !== 'IN_YARD') {
      throw new ConflictException(`Chỉ Relocate được khi Yard Visit đang IN_YARD (hiện tại: ${visit.status})`);
    }
    return this.prisma.movement.create({
      data: { yardVisitId: dto.yardVisitId, movementType: 'Relocation', fromSlotId: null, toSlotId: null, reason: dto.reason },
    });
  }
}
