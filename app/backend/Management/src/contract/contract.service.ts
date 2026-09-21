import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

// ============================================================
// ContractService — LỚP NGHIỆP VỤ (business logic layer).
//
// @Injectable() + constructor nhận PrismaService làm tham số: đây chính là
// Dependency Injection (DI). Bạn KHÔNG tự viết "new PrismaService()" ở đây
// — NestJS tự tạo sẵn 1 instance PrismaService (nhờ PrismaModule khai
// providers/exports) rồi "tiêm" vào constructor khi ContractModule khởi tạo
// ContractService. Lợi ích:
//   1. Test dễ hơn — khi viết unit test, có thể "tiêm" một PrismaService giả
//      (mock) vào thay vì phải có DB thật.
//   2. Không phải lo việc PrismaService được tạo/hủy ở đâu, khi nào —
//      NestJS quản lý vòng đời đó.
//
// Vì sao logic KHÔNG nằm ở Controller? Vì Controller chỉ nên lo việc
// "nhận HTTP request, trả HTTP response" — mọi quy tắc nghiệp vụ (vd:
// FR-01.2 "Draft→Active khi hợp lệ") đặt ở Service để:
//   - Tái sử dụng được (module khác gọi ContractService.activate() trực
//     tiếp, không cần đi qua HTTP).
//   - Test được logic nghiệp vụ riêng, không cần giả lập HTTP request.
// ============================================================
@Injectable()
export class ContractService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- CRUD cơ bản ----
  create(dto: CreateContractDto) {
    // prisma.contract.create() — Prisma tự sinh câu lệnh SQL INSERT tương ứng.
    // status không nhận từ client — mặc định "Draft" (khớp @default("Draft")
    // trong schema.prisma và luồng nghiệp vụ mục 2.1 SRS: Contract luôn bắt
    // đầu ở Draft).
    return this.prisma.contract.create({
      data: {
        customerId: dto.customerId,
        effectiveDate: new Date(dto.effectiveDate),
        expiryDate: new Date(dto.expiryDate),
        unitPrice: dto.unitPrice,
        freeTimeDays: dto.freeTimeDays,
        surchargeRate: dto.surchargeRate,
        paymentTerms: dto.paymentTerms,
      },
    });
  }

  findAll() {
    // findMany() không có điều kiện = lấy tất cả. Ở bước sau sẽ thêm
    // search/filter/sort/pagination (yêu cầu kỹ thuật mục 6 SRS) bằng cách
    // truyền thêm { where, orderBy, skip, take } vào đây.
    return this.prisma.contract.findMany();
  }

  async findOne(contractId: string) {
    const contract = await this.prisma.contract.findUnique({ where: { contractId } });
    if (!contract) {
      // NestJS tự bắt exception này, trả về đúng HTTP 404 + body JSON chuẩn.
      throw new NotFoundException(`Contract ${contractId} không tồn tại`);
    }
    return contract;
  }

  async update(contractId: string, dto: UpdateContractDto) {
    await this.findOne(contractId); // ném 404 sớm nếu không tồn tại
    return this.prisma.contract.update({
      where: { contractId },
      data: {
        ...(dto.unitPrice !== undefined && { unitPrice: dto.unitPrice }),
        ...(dto.freeTimeDays !== undefined && { freeTimeDays: dto.freeTimeDays }),
        ...(dto.surchargeRate !== undefined && { surchargeRate: dto.surchargeRate }),
        ...(dto.paymentTerms !== undefined && { paymentTerms: dto.paymentTerms }),
        ...(dto.expiryDate !== undefined && { expiryDate: new Date(dto.expiryDate) }),
      },
    });
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
    return this.prisma.contract.update({
      where: { contractId },
      data: { status: 'Active' },
    });
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
    return this.prisma.contract.update({
      where: { contractId },
      data: { status: 'Terminated' },
    });
  }
}
