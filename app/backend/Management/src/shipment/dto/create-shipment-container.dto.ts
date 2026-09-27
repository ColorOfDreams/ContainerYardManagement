import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateShipmentContainerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  containerId: string;

  @ApiProperty() @IsString() sealNumber: string;
  @ApiProperty() @IsString() sealType: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) grossWeightActual?: number;
}
