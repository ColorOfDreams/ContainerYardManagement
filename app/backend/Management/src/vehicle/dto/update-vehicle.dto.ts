import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

// Chỉ cho sửa thông tin mô tả — đổi status phải qua /maintenance, /available
// (giống ContainerService, tránh PATCH tuỳ tiện đổi trạng thái).
export class UpdateVehicleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleType?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) capacity?: number;
}
