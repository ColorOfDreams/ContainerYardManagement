import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ example: '51C-12345' })
  @IsString()
  plateNumber: string;

  @ApiProperty({ example: 'Xe đầu kéo' })
  @IsString()
  vehicleType: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) capacity?: number;
}
