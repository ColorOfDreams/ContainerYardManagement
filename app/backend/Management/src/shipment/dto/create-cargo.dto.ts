import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCargoDto {
  @ApiProperty() @IsString() cargoType: string;
  @ApiProperty() @IsNumber() @Min(0) weight: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) volume?: number;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isHazardous?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() temperatureMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() temperatureMax?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() humidityMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() humidityMax?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() specialHandling?: string;
}
