import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'The token from the verification link' })
  @IsString()
  token: string;
}
