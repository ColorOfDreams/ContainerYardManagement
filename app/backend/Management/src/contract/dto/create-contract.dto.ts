import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

// ============================================================
// DTO = Data Transfer Object — "khuôn" mô tả dữ liệu ĐƯỢC PHÉP đi vào/ra
// giữa client và server. Đây KHÔNG phải là model DB (khác PrismaClient's
// Contract type) — DTO chỉ quan tâm "request body hợp lệ trông như thế nào".
//
// Vì sao cần tách riêng DTO thay vì dùng thẳng kiểu Contract của Prisma?
// - Khi tạo mới, contract_id/created_at/status không nên cho client tự gửi
//   lên (server tự sinh) — DTO chỉ khai báo đúng những field client ĐƯỢC gửi.
// - Decorator (@IsString, @IsNumber...) từ class-validator tự động kiểm tra
//   request body ngay ở "cổng vào" (Controller), sai kiểu/thiếu field thì
//   trả lỗi 400 luôn, Service không bao giờ nhận dữ liệu bẩn.
// - @ApiProperty() giúp Swagger tự sinh tài liệu đúng theo DTO này — khớp
//   với ContractCreate trong docs/API_Kho_bai_Container_v1.yaml đã thiết kế.
// ============================================================
export class CreateContractDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  warehouseId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  effectiveDate: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  expiryDate: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  freeTimeDays: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  surchargeRate: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymentTerms?: string;
}
