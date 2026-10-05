import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const INVOICE_COLUMNS =
  'invoice_id, contract_id, yard_visit_id, invoice_type, actual_storage_duration, overdue_days, base_storage_fee, surcharge_amount, total_amount, payment_status, issued_at';
const PAYMENT_COLUMNS = 'payment_id, invoice_id, amount_paid, payment_method, payment_date, note, created_at';

// DTO dùng tên enum liền không dấu (khớp quy ước Prisma cũ); DB lưu đúng
// theo SRS (có khoảng trắng) — cần map tay vì không còn Prisma @map nữa.
const INVOICE_TYPE_DB: Record<string, string> = {
  Deposit: 'Deposit',
  StorageFee: 'Storage Fee',
  FinalSettlement: 'Final Settlement',
  Other: 'Other',
};
const PAYMENT_METHOD_DB: Record<string, string> = {
  BankTransfer: 'Bank Transfer',
  Cash: 'Cash',
  Card: 'Card',
};

// ============================================================
// InvoiceService — FR-10. StorageFee/FinalSettlement tự tính theo
// SRS v5 mục 2.2 (free_time_days áp dụng riêng mỗi Yard Visit) + Contract
// (unit_price, surcharge_rate). Deposit/Other dùng total_amount client
// truyền thẳng (VD bồi thường tranh chấp FR-09, xem State Business mục 5 #7).
// ============================================================
@Injectable()
export class InvoiceService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(filter: { contractId?: string; paymentStatus?: string; invoiceType?: string }) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter.contractId) {
      params.push(filter.contractId);
      conditions.push(`contract_id = $${params.length}`);
    }
    if (filter.paymentStatus) {
      params.push(filter.paymentStatus);
      conditions.push(`payment_status = $${params.length}`);
    }
    if (filter.invoiceType) {
      params.push(INVOICE_TYPE_DB[filter.invoiceType] ?? filter.invoiceType);
      conditions.push(`invoice_type = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.db.query(
      `SELECT ${INVOICE_COLUMNS} FROM management.invoice ${where} ORDER BY issued_at DESC`,
      params,
    );
    return result.rows;
  }

  async findOne(invoiceId: string) {
    const result = await this.db.query(`SELECT ${INVOICE_COLUMNS} FROM management.invoice WHERE invoice_id = $1`, [invoiceId]);
    if (result.rows.length === 0) throw new NotFoundException(`Invoice ${invoiceId} không tồn tại`);
    return result.rows[0];
  }

  async create(dto: CreateInvoiceDto) {
    const contract = await this.db.query<{ unit_price: string; surcharge_rate: string }>(
      `SELECT unit_price, surcharge_rate FROM management.contract WHERE contract_id = $1`,
      [dto.contractId],
    );
    if (contract.rows.length === 0) throw new NotFoundException(`Contract ${dto.contractId} không tồn tại`);

    const invoiceType = INVOICE_TYPE_DB[dto.invoiceType] ?? dto.invoiceType;
    const needsAutoCalc = dto.invoiceType === 'StorageFee' || dto.invoiceType === 'FinalSettlement';
    if (!needsAutoCalc) {
      if (dto.totalAmount === undefined) {
        throw new BadRequestException('totalAmount là bắt buộc với invoiceType Deposit/Other');
      }
      const result = await this.db.query(
        `INSERT INTO management.invoice (contract_id, yard_visit_id, invoice_type, total_amount)
         VALUES ($1, $2, $3, $4)
         RETURNING ${INVOICE_COLUMNS}`,
        [dto.contractId, dto.yardVisitId ?? null, invoiceType, dto.totalAmount],
      );
      return result.rows[0];
    }

    if (!dto.yardVisitId) throw new BadRequestException('yardVisitId là bắt buộc với invoiceType StorageFee/FinalSettlement');
    const visit = await this.db.query<{ ata: Date | null; eta: Date; atd: Date | null; free_time_days_snapshot: number }>(
      `SELECT ata, eta, atd, free_time_days_snapshot FROM management.yard_visit WHERE yard_visit_id = $1`,
      [dto.yardVisitId],
    );
    if (visit.rows.length === 0) throw new NotFoundException(`Yard Visit ${dto.yardVisitId} không tồn tại`);

    const { ata, eta, atd, free_time_days_snapshot } = visit.rows[0];
    const start = ata ?? eta;
    const end = atd ?? new Date();
    const actualStorageDuration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
    const overdueDays = Math.max(0, actualStorageDuration - free_time_days_snapshot);
    const unitPrice = Number(contract.rows[0].unit_price);
    const surchargeRate = Number(contract.rows[0].surcharge_rate);
    const baseStorageFee = unitPrice * actualStorageDuration;
    const surchargeAmount = overdueDays * unitPrice * surchargeRate;

    const result = await this.db.query(
      `INSERT INTO management.invoice
         (contract_id, yard_visit_id, invoice_type, actual_storage_duration, overdue_days, base_storage_fee, surcharge_amount, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${INVOICE_COLUMNS}`,
      [dto.contractId, dto.yardVisitId, invoiceType, actualStorageDuration, overdueDays, baseStorageFee, surchargeAmount, baseStorageFee + surchargeAmount],
    );
    return result.rows[0];
  }

  async listPayments(invoiceId: string) {
    const result = await this.db.query(
      `SELECT ${PAYMENT_COLUMNS} FROM management.payment WHERE invoice_id = $1 ORDER BY payment_date DESC`,
      [invoiceId],
    );
    return result.rows;
  }

  async createPayment(invoiceId: string, dto: CreatePaymentDto) {
    const invoice = await this.findOne(invoiceId);
    const paid = await this.db.query<{ sum: string | null }>(
      `SELECT SUM(amount_paid) FROM management.payment WHERE invoice_id = $1`,
      [invoiceId],
    );
    const alreadyPaid = Number(paid.rows[0].sum ?? 0);
    const totalAmount = Number(invoice.total_amount);
    const newTotal = alreadyPaid + dto.amountPaid;

    if (newTotal > totalAmount) {
      throw new BadRequestException(`Tổng amount_paid (${newTotal}) vượt total_amount (${totalAmount}) của Invoice`);
    }

    return this.db.transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO management.payment (invoice_id, amount_paid, payment_method, payment_date, note)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${PAYMENT_COLUMNS}`,
        [invoiceId, dto.amountPaid, PAYMENT_METHOD_DB[dto.paymentMethod] ?? dto.paymentMethod, dto.paymentDate, dto.note ?? null],
      );
      const paymentStatus = newTotal >= totalAmount ? 'Paid' : newTotal > 0 ? 'Partial' : 'Unpaid';
      await client.query(`UPDATE management.invoice SET payment_status = $1 WHERE invoice_id = $2`, [paymentStatus, invoiceId]);
      return result.rows[0];
    });
  }
}
