import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'container:create' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/)
  code: string;

  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}
