import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateYardVisitDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  shipmentContainerId: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  eta: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  etd?: string;
}
