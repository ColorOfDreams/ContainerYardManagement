import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================================
// ReportsService — FR-11 (bản giản lược). KHÔNG implement:
//   - GET /reports/warehouse-occupancy — cần thêm truy vấn tổng hợp theo
//     Warehouse (xem docs/API_Kho_bai_Container_v1.yaml), chưa làm ở bước này.
//   - GET /reports/my-containers — cần liên kết User<->Customer, schema hiện
//     tại không có (Contract.customerId là UUID rời rạc, không phải khoá
//     tới bảng User). Muốn tra cứu theo khách hàng, dùng
//     GET /contracts?customer_id=... + GET /yard-visits kết hợp thủ công.
// ============================================================
@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  async overdueContainers() {
    const result = await this.db.query<{ ata: Date; free_time_days_snapshot: number }>(
      `SELECT * FROM management.yard_visit
       WHERE status IN ('IN_YARD', 'STAGING') AND ata IS NOT NULL`,
    );
    const now = Date.now();
    return result.rows.filter((visit) => {
      const daysInYard = Math.floor((now - visit.ata.getTime()) / MS_PER_DAY);
      return daysInYard > visit.free_time_days_snapshot;
    });
  }

  async yardVisitSchedule(from?: string, to?: string) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (from) {
      params.push(from);
      conditions.push(`eta >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`eta <= $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.db.query(`SELECT * FROM management.yard_visit ${where} ORDER BY eta ASC`, params);
    return result.rows;
  }

  async revenue(contractId?: string, from?: string, to?: string) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (contractId) {
      params.push(contractId);
      conditions.push(`contract_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`issued_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`issued_at <= $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const invoices = await this.db.query<{ invoice_id: string; contract_id: string; total_amount: string }>(
      `SELECT invoice_id, contract_id, total_amount FROM management.invoice ${where}`,
      params,
    );

    const invoiceIds = invoices.rows.map((invoice) => invoice.invoice_id);
    const payments = invoiceIds.length
      ? await this.db.query<{ invoice_id: string; amount_paid: string }>(
          `SELECT invoice_id, amount_paid FROM management.payment WHERE invoice_id = ANY($1)`,
          [invoiceIds],
        )
      : { rows: [] as { invoice_id: string; amount_paid: string }[] };

    const paidByInvoice = new Map<string, number>();
    for (const payment of payments.rows) {
      paidByInvoice.set(payment.invoice_id, (paidByInvoice.get(payment.invoice_id) ?? 0) + Number(payment.amount_paid));
    }

    const byContract = new Map<string, { totalInvoiced: number; totalPaid: number }>();
    let totalInvoiced = 0;
    let totalPaid = 0;
    for (const invoice of invoices.rows) {
      const invoiced = Number(invoice.total_amount);
      const paid = paidByInvoice.get(invoice.invoice_id) ?? 0;
      totalInvoiced += invoiced;
      totalPaid += paid;
      const entry = byContract.get(invoice.contract_id) ?? { totalInvoiced: 0, totalPaid: 0 };
      entry.totalInvoiced += invoiced;
      entry.totalPaid += paid;
      byContract.set(invoice.contract_id, entry);
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
