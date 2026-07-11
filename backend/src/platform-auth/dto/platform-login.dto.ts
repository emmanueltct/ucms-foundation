import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class PlatformLoginDto {
  @ApiProperty({ example: 'platform-admin@ucms.app' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'ChangeMe123' })
  @IsString()
  password: string;
}
