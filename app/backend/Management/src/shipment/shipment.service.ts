import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { YardVisitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { CreateShipmentContainerDto } from './dto/create-shipment-container.dto';
import { CreateCargoDto } from './dto/create-cargo.dto';

const TERMINAL_YARD_VISIT_STATUSES: YardVisitStatus[] = ['CLOSED', 'REJECTED', 'CANCELLED'];

// ============================================================
// ShipmentService — FR-03. Shipment.status là DERIVED (State Business 4.2):
// hệ thống KHÔNG cho client tự set — chỉ tự chuyển qua depart() (Planned->
// InTransit) và 2 transition derived khác (InTransit->Arrived, Arrived->
// Completed) được YardVisitService gọi khi container đầu tiên Gate-in /
// container cuối cùng CLOSED (xem yard-visit/yard-visit.service.ts).
// ============================================================
@Injectable()
export class ShipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateShipmentDto) {
    const contract = await this.prisma.contract.findUnique({ where: { contractId: dto.contractId } });
    if (!contract) throw new NotFoundException(`Contract ${dto.contractId} không tồn tại`);
    if (contract.status !== 'Active') {
      throw new ConflictException(`Contract phải đang Active mới tạo được Shipment (hiện tại: ${contract.status})`);
    }
    return this.prisma.shipment.create({ data: { ...dto } });
  }

  findAll() {
    return this.prisma.shipment.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { shipmentId } });
    if (!shipment) throw new NotFoundException(`Shipment ${shipmentId} không tồn tại`);
    return shipment;
  }

  async update(shipmentId: string, dto: UpdateShipmentDto) {
    await this.findOne(shipmentId);
    return this.prisma.shipment.update({ where: { shipmentId }, data: { ...dto } });
  }

  async depart(shipmentId: string) {
    const shipment = await this.findOne(shipmentId);
    if (shipment.status !== 'Planned') {
      throw new ConflictException(`Chỉ Shipment đang Planned mới depart được (hiện tại: ${shipment.status})`);
    }
    return this.prisma.shipment.update({ where: { shipmentId }, data: { status: 'InTransit' } });
  }

  listContainers(shipmentId: string) {
    return this.prisma.shipmentContainer.findMany({ where: { shipmentId }, orderBy: { createdAt: 'desc' } });
  }

  async addContainer(shipmentId: string, dto: CreateShipmentContainerDto) {
    await this.findOne(shipmentId);
    const container = await this.prisma.container.findUnique({ where: { containerId: dto.containerId } });
    if (!container) throw new NotFoundException(`Container ${dto.containerId} không tồn tại`);

    const openVisit = await this.prisma.yardVisit.findFirst({
      where: { shipmentContainer: { containerId: dto.containerId }, status: { notIn: TERMINAL_YARD_VISIT_STATUSES } },
    });
    if (openVisit) {
      throw new ConflictException('Container đang có Yard Visit chưa Closed/Rejected/Cancelled ở Shipment khác');
    }

    return this.prisma.shipmentContainer.create({ data: { shipmentId, ...dto } });
  }

  async findShipmentContainer(shipmentContainerId: string) {
    const sc = await this.prisma.shipmentContainer.findUnique({ where: { shipmentContainerId } });
    if (!sc) throw new NotFoundException(`Shipment_Container ${shipmentContainerId} không tồn tại`);
    return sc;
  }

  listCargo(shipmentContainerId: string) {
    return this.prisma.cargo.findMany({ where: { shipmentContainerId }, orderBy: { createdAt: 'desc' } });
  }

  async addCargo(shipmentContainerId: string, dto: CreateCargoDto) {
    await this.findShipmentContainer(shipmentContainerId);
    return this.prisma.cargo.create({ data: { shipmentContainerId, ...dto } });
  }
}
