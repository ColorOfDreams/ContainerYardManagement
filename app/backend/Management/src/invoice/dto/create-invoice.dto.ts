import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export enum InvoiceTypeDto {
  Deposit = 'Deposit',
  StorageFee = 'StorageFee',
  FinalSettlement = 'FinalSettlement',
  Other = 'Other',
}

export class CreateInvoiceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  contractId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Bắt buộc với invoiceType=StorageFee/FinalSettlement — dùng để tự tính phí lưu bãi' })
  @IsOptional()
  @IsUUID()
  yardVisitId?: string;

  @ApiProperty({ enum: InvoiceTypeDto })
  @IsEnum(InvoiceTypeDto)
  invoiceType: InvoiceTypeDto;

  @ApiPropertyOptional({ description: 'Bắt buộc với invoiceType=Deposit/Other — StorageFee/FinalSettlement tự tính, bỏ qua field này nếu có truyền' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;
}
