import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

const CONTRACT_COLUMNS =
  'contract_id, warehouse_id, customer_id, effective_date, expiry_date, unit_price, free_time_days, surcharge_rate, payment_terms, status, created_at, updated_at';

@Injectable()
export class ContractService {
  constructor(private readonly db: DatabaseService) {}

  // ---- CRUD cơ bản ----
  async create(dto: CreateContractDto) {
    // status không nhận từ client — mặc định "Draft" (DEFAULT trong DB,
    // khớp luồng nghiệp vụ mục 2.1 SRS: Contract luôn bắt đầu ở Draft).
    const result = await this.db.query(
      `INSERT INTO management.contract
         (warehouse_id, customer_id, effective_date, expiry_date, unit_price, free_time_days, surcharge_rate, payment_terms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${CONTRACT_COLUMNS}`,
      [
        dto.warehouseId,
        dto.customerId,
        dto.effectiveDate,
        dto.expiryDate,
        dto.unitPrice,
        dto.freeTimeDays,
        dto.surchargeRate,
        dto.paymentTerms ?? null,
      ],
    );
    return result.rows[0];
  }

  async findAll() {
    const result = await this.db.query(`SELECT ${CONTRACT_COLUMNS} FROM management.contract`);
    return result.rows;
  }

  async findOne(contractId: string) {
    const result = await this.db.query(
      `SELECT ${CONTRACT_COLUMNS} FROM management.contract WHERE contract_id = $1`,
      [contractId],
    );
    if (result.rows.length === 0) {
      // NestJS tự bắt exception này, trả về đúng HTTP 404 + body JSON chuẩn.
      throw new NotFoundException(`Contract ${contractId} không tồn tại`);
    }
    return result.rows[0];
  }

  async update(contractId: string, dto: UpdateContractDto) {
    await this.findOne(contractId); // ném 404 sớm nếu không tồn tại
    const result = await this.db.query(
      `UPDATE management.contract
       SET unit_price = COALESCE($1, unit_price),
           free_time_days = COALESCE($2, free_time_days),
           surcharge_rate = COALESCE($3, surcharge_rate),
           payment_terms = COALESCE($4, payment_terms),
           expiry_date = COALESCE($5, expiry_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE contract_id = $6
       RETURNING ${CONTRACT_COLUMNS}`,
      [
        dto.unitPrice ?? null,
        dto.freeTimeDays ?? null,
        dto.surchargeRate ?? null,
        dto.paymentTerms ?? null,
        dto.expiryDate ?? null,
        contractId,
      ],
    );
    return result.rows[0];
  }

  // ---- State machine transitions (FR-01, đúng theo State Business mục 4.1) ----

  async activate(contractId: string) {
    const contract = await this.findOne(contractId);
    if (contract.status !== 'Draft') {
      // ConflictException -> HTTP 409, đúng nghĩa: "yêu cầu hợp lệ về mặt cú
      // pháp, nhưng trạng thái hiện tại không cho phép hành động này".
      throw new ConflictException(
        `Chỉ Contract đang Draft mới Active được (hiện tại: ${contract.status})`,
      );
    }
    const result = await this.db.query(
      `UPDATE management.contract SET status = 'Active', updated_at = CURRENT_TIMESTAMP
       WHERE contract_id = $1 RETURNING ${CONTRACT_COLUMNS}`,
      [contractId],
    );
    return result.rows[0];
  }

  async terminate(contractId: string, reason: string) {
    const contract = await this.findOne(contractId);
    if (contract.status !== 'Active') {
      throw new ConflictException(
        `Chỉ Contract đang Active mới Terminate được (hiện tại: ${contract.status})`,
      );
    }
    // Lưu ý: KHÔNG có nhánh nào tự động gọi terminate() khi Invoice
    // thanh toán đủ — đúng quyết định đã chốt (mục 3.1 State Business):
    // Terminated chỉ do Admin chủ động, không phải hệ quả của thanh toán.
    // (reason nên được ghi vào bảng audit/log riêng — sẽ bổ sung khi làm
    // audit trail đầy đủ theo NFR "Audit trail" trong SRS mục 5.)
    void reason;
    const result = await this.db.query(
      `UPDATE management.contract SET status = 'Terminated', updated_at = CURRENT_TIMESTAMP
       WHERE contract_id = $1 RETURNING ${CONTRACT_COLUMNS}`,
      [contractId],
    );
    return result.rows[0];
  }
}
