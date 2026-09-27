import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateShipmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  contractId: string;

  @ApiProperty() @IsString() shipper: string;
  @ApiProperty() @IsString() consignee: string;
  @ApiProperty() @IsString() carrier: string;

  @ApiPropertyOptional() @IsOptional() @IsString() origin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() loadingPort?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dischargePort?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vessel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() voyage?: string;
}
