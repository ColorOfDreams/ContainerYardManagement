import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty() @IsString() name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;

  @ApiProperty({ description: 'Sức chứa tối đa (số Yard Visit đồng thời)' })
  @IsInt()
  @Min(1)
  capacity: number;
}
