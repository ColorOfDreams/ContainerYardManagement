import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateContainerDto {
  @ApiProperty({ example: 'MSCU1234567' })
  @IsString()
  containerCode: string;

  @ApiProperty({ example: 'Dry Van' })
  @IsString()
  containerType: string;

  @ApiProperty({ example: '40HC' })
  @IsString()
  sizeTypeCode: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) tareWeight?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) maxGrossWeight?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) maxPayload?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) capacity?: number;
}
