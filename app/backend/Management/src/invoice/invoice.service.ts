import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================================
// InvoiceService — FR-10. StorageFee/FinalSettlement tự tính theo
// SRS v5 mục 2.2 (free_time_days áp dụng riêng mỗi Yard Visit) + Contract
// (unit_price, surcharge_rate). Deposit/Other dùng total_amount client
// truyền thẳng (VD bồi thường tranh chấp FR-09, xem State Business mục 5 #7).
// ============================================================
@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filter: { contractId?: string; paymentStatus?: string; invoiceType?: string }) {
    return this.prisma.invoice.findMany({
      where: {
        ...(filter.contractId && { contractId: filter.contractId }),
        ...(filter.paymentStatus && { paymentStatus: filter.paymentStatus as never }),
        ...(filter.invoiceType && { invoiceType: filter.invoiceType as never }),
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async findOne(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { invoiceId } });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} không tồn tại`);
    return invoice;
  }

  async create(dto: CreateInvoiceDto) {
    const contract = await this.prisma.contract.findUnique({ where: { contractId: dto.contractId } });
    if (!contract) throw new NotFoundException(`Contract ${dto.contractId} không tồn tại`);

    const needsAutoCalc = dto.invoiceType === 'StorageFee' || dto.invoiceType === 'FinalSettlement';
    if (!needsAutoCalc) {
      if (dto.totalAmount === undefined) {
        throw new BadRequestException('totalAmount là bắt buộc với invoiceType Deposit/Other');
      }
      return this.prisma.invoice.create({
        data: { contractId: dto.contractId, yardVisitId: dto.yardVisitId, invoiceType: dto.invoiceType, totalAmount: dto.totalAmount },
      });
    }

    if (!dto.yardVisitId) throw new BadRequestException('yardVisitId là bắt buộc với invoiceType StorageFee/FinalSettlement');
    const visit = await this.prisma.yardVisit.findUnique({ where: { yardVisitId: dto.yardVisitId } });
    if (!visit) throw new NotFoundException(`Yard Visit ${dto.yardVisitId} không tồn tại`);

    const start = visit.ata ?? visit.eta;
    const end = visit.atd ?? new Date();
    const actualStorageDuration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
    const overdueDays = Math.max(0, actualStorageDuration - visit.freeTimeDaysSnapshot);
    const unitPrice = Number(contract.unitPrice);
    const surchargeRate = Number(contract.surchargeRate);
    const baseStorageFee = unitPrice * actualStorageDuration;
    const surchargeAmount = overdueDays * unitPrice * surchargeRate;

    return this.prisma.invoice.create({
      data: {
        contractId: dto.contractId,
        yardVisitId: dto.yardVisitId,
        invoiceType: dto.invoiceType,
        actualStorageDuration,
        overdueDays,
        baseStorageFee,
        surchargeAmount,
        totalAmount: baseStorageFee + surchargeAmount,
      },
    });
  }

  listPayments(invoiceId: string) {
    return this.prisma.payment.findMany({ where: { invoiceId }, orderBy: { paymentDate: 'desc' } });
  }

  async createPayment(invoiceId: string, dto: CreatePaymentDto) {
    const invoice = await this.findOne(invoiceId);
    const paid = await this.prisma.payment.aggregate({ where: { invoiceId }, _sum: { amountPaid: true } });
    const alreadyPaid = Number(paid._sum.amountPaid ?? 0);
    const totalAmount = Number(invoice.totalAmount);
    const newTotal = alreadyPaid + dto.amountPaid;

    if (newTotal > totalAmount) {
      throw new BadRequestException(`Tổng amount_paid (${newTotal}) vượt total_amount (${totalAmount}) của Invoice`);
    }

    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({ data: { invoiceId, ...dto, paymentDate: new Date(dto.paymentDate) } }),
      this.prisma.invoice.update({
        where: { invoiceId },
        data: { paymentStatus: newTotal >= totalAmount ? 'Paid' : newTotal > 0 ? 'Partial' : 'Unpaid' },
      }),
    ]);
    return payment;
  }
}
