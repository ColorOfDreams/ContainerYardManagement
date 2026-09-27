import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================================
// ReportsService — FR-11 (bản giản lược). KHÔNG implement:
//   - GET /reports/slot-occupancy — cần dữ liệu Slot (Yard Optimize Service
//     chưa triển khai).
//   - GET /reports/my-containers — cần liên kết User<->Customer, schema hiện
//     tại không có (Contract.customerId là UUID rời rạc, không phải khoá
//     tới bảng User). Muốn tra cứu theo khách hàng, dùng
//     GET /contracts?customer_id=... + GET /yard-visits kết hợp thủ công.
// ============================================================
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overdueContainers() {
    const candidates = await this.prisma.yardVisit.findMany({
      where: { status: { in: ['IN_YARD', 'STAGING'] }, ata: { not: null } },
    });
    const now = Date.now();
    return candidates.filter((visit) => {
      const daysInYard = Math.floor((now - visit.ata!.getTime()) / MS_PER_DAY);
      return daysInYard > visit.freeTimeDaysSnapshot;
    });
  }

  yardVisitSchedule(from?: string, to?: string) {
    return this.prisma.yardVisit.findMany({
      where: {
        ...(from || to
          ? { eta: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }
          : {}),
      },
      orderBy: { eta: 'asc' },
    });
  }

  async revenue(contractId?: string, from?: string, to?: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(contractId && { contractId }),
        ...((from || to) && { issuedAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
      },
      include: { payments: true },
    });

    const byContract = new Map<string, { totalInvoiced: number; totalPaid: number }>();
    let totalInvoiced = 0;
    let totalPaid = 0;
    for (const invoice of invoices) {
      const invoiced = Number(invoice.totalAmount);
      const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
      totalInvoiced += invoiced;
      totalPaid += paid;
      const entry = byContract.get(invoice.contractId) ?? { totalInvoiced: 0, totalPaid: 0 };
      entry.totalInvoiced += invoiced;
      entry.totalPaid += paid;
      byContract.set(invoice.contractId, entry);
    }

    return {
      totalInvoiced,
      totalPaid,
      totalReceivable: totalInvoiced - totalPaid,
      byContract: [...byContract.entries()].map(([id, v]) => ({
        contractId: id,
        totalInvoiced: v.totalInvoiced,
        totalPaid: v.totalPaid,
        totalReceivable: v.totalInvoiced - v.totalPaid,
      })),
    };
  }
}
