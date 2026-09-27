import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum PaymentMethodDto {
  BankTransfer = 'BankTransfer',
  Cash = 'Cash',
  Card = 'Card',
}

export class CreatePaymentDto {
  @ApiProperty() @IsNumber() @Min(0.01) amountPaid: number;

  @ApiProperty({ enum: PaymentMethodDto })
  @IsEnum(PaymentMethodDto)
  paymentMethod: PaymentMethodDto;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  paymentDate: string;

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
