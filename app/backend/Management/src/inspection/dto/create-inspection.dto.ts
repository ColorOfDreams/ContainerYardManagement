import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum InspectionTypeDto {
  GateIn = 'GateIn',
  GateOut = 'GateOut',
  AdHoc = 'AdHoc',
}

export enum InspectionResultDto {
  Pass = 'Pass',
  Fail = 'Fail',
}

export enum InspectionFailReasonDto {
  seal_mismatch = 'seal_mismatch',
  physical_damage_minor = 'physical_damage_minor',
  physical_damage_severe = 'physical_damage_severe',
  other = 'other',
}

export class CreateInspectionDto {
  @ApiProperty({ enum: InspectionTypeDto })
  @IsEnum(InspectionTypeDto)
  inspectionType: InspectionTypeDto;

  @ApiProperty() @IsBoolean() sealCheck: boolean;

  @ApiProperty({ enum: InspectionResultDto })
  @IsEnum(InspectionResultDto)
  result: InspectionResultDto;

  @ApiPropertyOptional({ enum: InspectionFailReasonDto, description: 'Chỉ physical_damage_* mới kích hoạt Container MAINTENANCE/DAMAGED (xem State Business mục 5)' })
  @IsOptional()
  @IsEnum(InspectionFailReasonDto)
  failReason?: InspectionFailReasonDto;

  @ApiPropertyOptional() @IsOptional() @IsString() damageNotes?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Bắt buộc khi inspectionType=GateIn và result=Pass — chọn Warehouse còn dung lượng trống để gán current_warehouse_id (FR-06)' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Phương tiện thực hiện Gate-in (nếu có) — ghi vào Movement.vehicle_id' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
