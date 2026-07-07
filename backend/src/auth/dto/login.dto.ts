import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@demo-church.test' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'ChangeMe123' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: '123456', description: 'Required only if the account has MFA enabled' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  mfaCode?: string;
}
