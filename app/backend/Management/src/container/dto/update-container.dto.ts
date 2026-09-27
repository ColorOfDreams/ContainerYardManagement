import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

// Chỉ cho sửa thông tin mô tả — đổi status phải qua /maintenance, /available,
// /damage (có business rule + terminal state DAMAGED, không cho PATCH tuỳ tiện).
export class UpdateContainerDto {
  @ApiPropertyOptional() @IsOptional() @IsString() containerType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sizeTypeCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) tareWeight?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) maxGrossWeight?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) maxPayload?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) capacity?: number;
}
