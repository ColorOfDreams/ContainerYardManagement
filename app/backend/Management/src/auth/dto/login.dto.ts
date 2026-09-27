import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 6, description: 'Tối thiểu 6 ký tự, gồm ít nhất một chữ in hoa và một chữ số.' })
  @IsString()
  @Matches(/^(?=.*[A-Z])(?=.*\d).{6,}$/)
  password: string;
}
