import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateShipmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() shipper?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() consignee?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() carrier?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() loadingPort?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dischargePort?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vessel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() voyage?: string;
}
