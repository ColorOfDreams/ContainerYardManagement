import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class CreateUserDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ minLength: 6 }) @IsString() @Matches(/^(?=.*[A-Z])(?=.*\d).{6,}$/) password: string;
  @ApiPropertyOptional() @IsOptional() @IsString() displayName?: string;
  @ApiPropertyOptional({ type: [String], example: ['OPERATOR'] }) @IsOptional() @IsArray() @IsString({ each: true }) roleCodes?: string[];
}
