import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token lấy từ bước forgot-password (dạng resetTokenId.secret)' })
  @IsString()
  @MinLength(32)
  token: string;

  @ApiProperty({ minLength: 6, description: 'Tối thiểu 6 ký tự, gồm ít nhất một chữ in hoa và một chữ số.' })
  @IsString()
  @Matches(/^(?=.*[A-Z])(?=.*\d).{6,}$/)
  newPassword: string;
}
