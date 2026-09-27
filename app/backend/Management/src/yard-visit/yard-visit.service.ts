import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateYardVisitDto } from './dto/create-yard-visit.dto';
import { UpdateYardVisitDto } from './dto/update-yard-visit.dto';

const TERMINAL_STATUSES = ['CLOSED', 'REJECTED', 'CANCELLED'];

// ============================================================
// YardVisitService — FR-04/05/08/09. State machine đúng theo
// State_Business_Kho_bai_Container_v1.docx mục 4.5:
//   PLANNED -> ARRIVED -> IN_YARD -> STAGING -> DEPARTED -> CLOSED
//   PLANNED -> CANCELLED (Case 2, sự cố trước khi tới)
//   ARRIVED -> REJECTED (Inspection Gate-in Fail — xử lý ở InspectionService)
//
// currentSlotId / Movement.fromSlotId|toSlotId luôn null trong toàn bộ
// service này — Yard Optimize Service (chủ sở hữu dữ liệu Slot) chưa triển
// khai, đây là giản lược có chủ đích (xem plan).
// ============================================================
@Injectable()
export class YardVisitService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateYardVisitDto) {
    const sc = await this.prisma.shipmentContainer.findUnique({
      where: { shipmentContainerId: dto.shipmentContainerId },
      include: { shipment: { include: { contract: true } } },
    });
    if (!sc) throw new NotFoundException(`Shipment_Container ${dto.shipmentContainerId} không tồn tại`);

    return this.prisma.yardVisit.create({
      data: {
        shipmentContainerId: dto.shipmentContainerId,
        eta: new Date(dto.eta),
        etd: dto.etd ? new Date(dto.etd) : null,
        freeTimeDaysSnapshot: sc.shipment.contract.freeTimeDays,
      },
    });
  }

  findAll() {
    return this.prisma.yardVisit.findMany({ orderBy: { eta: 'desc' } });
  }

  async findOne(yardVisitId: string) {
    const visit = await this.prisma.yardVisit.findUnique({ where: { yardVisitId } });
    if (!visit) throw new NotFoundException(`Yard Visit ${yardVisitId} không tồn tại`);
    return visit;
  }

  async update(yardVisitId: string, dto: UpdateYardVisitDto) {
    const visit = await this.findOne(yardVisitId);
    if (TERMINAL_STATUSES.includes(visit.status)) {
      throw new ConflictException(`Yard Visit đã ở trạng thái cuối (${visit.status}) — không đổi lịch được nữa`);
    }
    return this.prisma.yardVisit.update({
      where: { yardVisitId },
      data: {
        ...(dto.eta !== undefined && { eta: new Date(dto.eta) }),
        ...(dto.etd !== undefined && { etd: new Date(dto.etd) }),
      },
    });
  }

  async cancel(yardVisitId: string, reason: string) {
    void reason; // ghi audit trail sau này — xem ghi chú tương tự ở ContractService.terminate
    const visit = await this.findOne(yardVisitId);
    if (visit.status !== 'PLANNED') {
      throw new ConflictException(`Chỉ Yard Visit đang PLANNED mới CANCELLED được (hiện tại: ${visit.status})`);
    }
    return this.prisma.yardVisit.update({ where: { yardVisitId }, data: { status: 'CANCELLED' } });
  }

  async gateIn(yardVisitId: string, ata?: string) {
    const visit = await this.findOne(yardVisitId);
    if (visit.status !== 'PLANNED') {
      throw new ConflictException(`Chỉ Yard Visit đang PLANNED mới Gate-in được (hiện tại: ${visit.status})`);
    }
    const updated = await this.prisma.yardVisit.update({
      where: { yardVisitId },
      data: { status: 'ARRIVED', ata: ata ? new Date(ata) : new Date() },
    });
    await this.markShipmentArrivedIfFirst(yardVisitId);
    return updated;
  }

  async stage(yardVisitId: string) {
    const visit = await this.findOne(yardVisitId);
    if (visit.status !== 'IN_YARD') {
      throw new ConflictException(`Chỉ Yard Visit đang IN_YARD mới Stage được (hiện tại: ${visit.status})`);
    }
    const openCustomsHold = await this.prisma.yardEvent.findFirst({
      where: { yardVisitId, eventType: 'CustomsHold', resolutionStatus: 'Open' },
    });
    if (openCustomsHold) {
      throw new ConflictException('Đang có Event Customs Hold chưa Resolved — không thể chuyển sang Staging (State Business Case 5)');
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.movement.create({ data: { yardVisitId, movementType: 'Rehandle', fromSlotId: null, toSlotId: null } }),
      this.prisma.yardVisit.update({ where: { yardVisitId }, data: { status: 'STAGING' } }),
    ]);
    return updated;
  }

  async gateOut(yardVisitId: string, atd?: string) {
    const visit = await this.findOne(yardVisitId);
    if (visit.status !== 'STAGING') {
      throw new ConflictException(`Chỉ Yard Visit đang STAGING mới Gate-out được (hiện tại: ${visit.status})`);
    }
    const gateOutInspection = await this.prisma.inspection.findFirst({
      where: { yardVisitId, inspectionType: 'GateOut' },
    });
    if (!gateOutInspection) {
      throw new ConflictException('Cần tạo Inspection type=Gate-out cho Yard Visit này trước khi Gate-out (FR-09.2)');
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.movement.create({ data: { yardVisitId, movementType: 'GateOut', fromSlotId: null, toSlotId: null } }),
      this.prisma.yardVisit.update({ where: { yardVisitId }, data: { status: 'DEPARTED', atd: atd ? new Date(atd) : new Date() } }),
    ]);
    return updated;
  }

  async close(yardVisitId: string) {
    const visit = await this.findOne(yardVisitId);
    if (visit.status !== 'DEPARTED') {
      throw new ConflictException(`Chỉ Yard Visit đang DEPARTED mới Close được (hiện tại: ${visit.status})`);
    }
    const updated = await this.prisma.yardVisit.update({ where: { yardVisitId }, data: { status: 'CLOSED' } });
    await this.markShipmentCompletedIfAllClosed(yardVisitId);
    return updated;
  }

  // ---- Derived Shipment.status transitions — State Business mục 4.2 ----

  private async markShipmentArrivedIfFirst(yardVisitId: string) {
    const shipment = await this.shipmentOf(yardVisitId);
    if (shipment && shipment.status === 'InTransit') {
      await this.prisma.shipment.update({ where: { shipmentId: shipment.shipmentId }, data: { status: 'Arrived' } });
    }
  }

  private async markShipmentCompletedIfAllClosed(yardVisitId: string) {
    const shipment = await this.shipmentOf(yardVisitId);
    if (!shipment || shipment.status !== 'Arrived') return;

    const containers = await this.prisma.shipmentContainer.findMany({
      where: { shipmentId: shipment.shipmentId },
      include: { yardVisits: true },
    });
    const allClosed = containers.every((sc) => sc.yardVisits.some((v) => v.status === 'CLOSED'));
    if (allClosed) {
      await this.prisma.shipment.update({ where: { shipmentId: shipment.shipmentId }, data: { status: 'Completed' } });
    }
  }

  private async shipmentOf(yardVisitId: string) {
    const visit = await this.prisma.yardVisit.findUnique({
      where: { yardVisitId },
      include: { shipmentContainer: { include: { shipment: true } } },
    });
    return visit?.shipmentContainer.shipment ?? null;
  }
}
