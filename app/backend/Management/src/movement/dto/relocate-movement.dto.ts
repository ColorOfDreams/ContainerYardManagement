import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RelocateMovementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  yardVisitId: string;

  @ApiProperty({ format: 'uuid', description: 'Warehouse mới còn dung lượng trống (FR-07.2)' })
  @IsUUID()
  toWarehouseId: string;

  @ApiProperty() @IsString() reason: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
