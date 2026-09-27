import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';

// ============================================================
// ContainerService — FR-02. State machine container (tài sản), theo đúng
// State_Business_Kho_bai_Container_v1.docx mục 4.3:
//   AVAILABLE <-> MAINTENANCE, AVAILABLE|MAINTENANCE -> DAMAGED (terminal).
// ============================================================
@Injectable()
export class ContainerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContainerDto) {
    const existing = await this.prisma.container.findUnique({ where: { containerCode: dto.containerCode } });
    if (existing) throw new ConflictException(`container_code ${dto.containerCode} đã tồn tại`);
    return this.prisma.container.create({ data: { ...dto } });
  }

  findAll() {
    return this.prisma.container.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(containerId: string) {
    const container = await this.prisma.container.findUnique({ where: { containerId } });
    if (!container) throw new NotFoundException(`Container ${containerId} không tồn tại`);
    return container;
  }

  async update(containerId: string, dto: UpdateContainerDto) {
    await this.findOne(containerId);
    return this.prisma.container.update({ where: { containerId }, data: { ...dto } });
  }

  async maintenance(containerId: string) {
    const container = await this.findOne(containerId);
    if (container.status !== 'AVAILABLE') {
      throw new ConflictException(`Chỉ Container đang AVAILABLE mới chuyển MAINTENANCE được (hiện tại: ${container.status})`);
    }
    return this.prisma.container.update({ where: { containerId }, data: { status: 'MAINTENANCE' } });
  }

  async available(containerId: string) {
    const container = await this.findOne(containerId);
    if (container.status === 'DAMAGED') {
      throw new ConflictException('Container đang DAMAGED — không thể chuyển thẳng sang AVAILABLE (terminal state)');
    }
    if (container.status !== 'MAINTENANCE') {
      throw new ConflictException(`Chỉ Container đang MAINTENANCE mới chuyển AVAILABLE được (hiện tại: ${container.status})`);
    }
    return this.prisma.container.update({ where: { containerId }, data: { status: 'AVAILABLE' } });
  }

  async damage(containerId: string) {
    const container = await this.findOne(containerId);
    if (container.status === 'DAMAGED') {
      throw new ConflictException('Container đã ở trạng thái DAMAGED');
    }
    // AVAILABLE hoặc MAINTENANCE đều được phép -> DAMAGED (terminal), áp dụng
    // cho cả hư hỏng phát hiện lúc Gate-in lẫn Gate-out (State Business 4.3).
    return this.prisma.container.update({ where: { containerId }, data: { status: 'DAMAGED' } });
  }
}
