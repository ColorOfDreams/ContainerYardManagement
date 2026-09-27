import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';

// ============================================================
// InspectionService — FR-05/09. Kết quả Inspection tác động dây chuyền theo
// State_Business_Kho_bai_Container_v1.docx mục 5 (Cross-Entity Trigger #2/#3/#7):
//   Gate-in Pass  -> YardVisit ARRIVED->IN_YARD + Movement(Gate-in)
//   Gate-in Fail  -> YardVisit ARRIVED->REJECTED + Event(Rejected)
//   Gate-out Fail -> Event(Dispute) — KHÔNG chặn YardVisit tiếp tục
//   Fail với fail_reason=physical_damage_minor/severe (bất kỳ loại nào)
//     -> Container MAINTENANCE/DAMAGED tương ứng
// ============================================================
@Injectable()
export class InspectionService {
  constructor(private readonly prisma: PrismaService) {}

  list(yardVisitId: string) {
    return this.prisma.inspection.findMany({ where: { yardVisitId }, orderBy: { inspectedAt: 'desc' } });
  }

  async create(yardVisitId: string, dto: CreateInspectionDto, inspectedBy: string) {
    const visit = await this.prisma.yardVisit.findUnique({
      where: { yardVisitId },
      include: { shipmentContainer: true },
    });
    if (!visit) throw new NotFoundException(`Yard Visit ${yardVisitId} không tồn tại`);

    if (dto.inspectionType === 'GateIn' && visit.status !== 'ARRIVED') {
      throw new ConflictException(`Yard Visit phải đang ARRIVED để tạo Inspection Gate-in (hiện tại: ${visit.status})`);
    }
    if (dto.inspectionType === 'GateOut' && visit.status !== 'STAGING') {
      throw new ConflictException(`Yard Visit phải đang STAGING để tạo Inspection Gate-out (hiện tại: ${visit.status})`);
    }

    const inspection = await this.prisma.inspection.create({
      data: { yardVisitId, ...dto, inspectedBy },
    });

    if (dto.inspectionType === 'GateIn' && dto.result === 'Pass') {
      await this.prisma.$transaction([
        this.prisma.yardVisit.update({ where: { yardVisitId }, data: { status: 'IN_YARD' } }),
        this.prisma.movement.create({ data: { yardVisitId, movementType: 'GateIn', fromSlotId: null, toSlotId: null } }),
      ]);
    } else if (dto.inspectionType === 'GateIn' && dto.result === 'Fail') {
      await this.prisma.$transaction([
        this.prisma.yardVisit.update({ where: { yardVisitId }, data: { status: 'REJECTED' } }),
        this.prisma.yardEvent.create({ data: { yardVisitId, eventType: 'Rejected', description: dto.damageNotes ?? 'Inspection Gate-in Fail' } }),
      ]);
    } else if (dto.inspectionType === 'GateOut' && dto.result === 'Fail') {
      await this.prisma.yardEvent.create({
        data: { yardVisitId, eventType: 'Dispute', description: dto.damageNotes ?? 'Tranh chấp phát hiện lúc Gate-out (FR-09)' },
      });
    }

    if (dto.result === 'Fail' && (dto.failReason === 'physical_damage_minor' || dto.failReason === 'physical_damage_severe')) {
      const container = await this.prisma.container.findUnique({ where: { containerId: visit.shipmentContainer.containerId } });
      // DAMAGED là terminal (State Business 4.3) — không hạ cấp ngược về MAINTENANCE.
      if (container && container.status !== 'DAMAGED') {
        await this.prisma.container.update({
          where: { containerId: visit.shipmentContainer.containerId },
          data: { status: dto.failReason === 'physical_damage_severe' ? 'DAMAGED' : 'MAINTENANCE' },
        });
      }
    }

    return inspection;
  }
}
