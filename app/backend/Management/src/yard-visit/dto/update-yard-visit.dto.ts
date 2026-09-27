import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

// FR-04.2 — chỉ cho đổi lịch (eta/etd), không cho sửa status qua PATCH.
export class UpdateYardVisitDto {
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() eta?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() etd?: string;
}
