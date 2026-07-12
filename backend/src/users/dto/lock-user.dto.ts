import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LockUserDto {
  @ApiPropertyOptional({ description: 'Why this account is being locked (shown in the audit trail)' })
  @IsOptional()
  @IsString()
  reason?: string;
}
