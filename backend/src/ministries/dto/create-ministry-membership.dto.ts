import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

const MINISTRY_ROLES = ['leader', 'volunteer', 'member'] as const;

export class CreateMinistryMembershipDto {
  @ApiProperty({ description: 'Ministry the member is joining' })
  @IsUUID()
  ministryId: string;

  @ApiProperty({ description: 'Member being added to the ministry' })
  @IsUUID()
  memberId: string;

  @ApiPropertyOptional({ enum: MINISTRY_ROLES, default: 'member' })
  @IsOptional()
  @IsIn(MINISTRY_ROLES)
  role?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  joinedAt?: string;
}
