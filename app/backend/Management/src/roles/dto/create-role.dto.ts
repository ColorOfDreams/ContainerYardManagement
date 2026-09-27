import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Matches } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'YARD_MANAGER' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,63}$/)
  code: string;

  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ type: [String], example: ['contract:read'] }) @IsOptional() @IsArray() @IsString({ each: true }) permissionCodes?: string[];
}
