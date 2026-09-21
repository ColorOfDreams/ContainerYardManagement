import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// UpdateContractDto — khớp FR-01: chỉ cho sửa điều khoản thương mại
// (đơn giá, free_time_days, surcharge_rate, payment_terms, expiry_date).
// KHÔNG có "status" ở đây — đổi status phải qua endpoint riêng
// (/activate, /terminate) có business rule đi kèm, không cho PATCH tùy tiện
// — đúng nguyên tắc trong State Business: mọi transition phải có điều kiện rõ ràng.
export class UpdateContractDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  freeTimeDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  surchargeRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
