import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

const SMALL_GROUP_ROLES = ['leader', 'co_leader', 'member'] as const;

export class CreateSmallGroupMembershipDto {
  @ApiProperty({ description: 'Small group the member is joining' })
  @IsUUID()
  smallGroupId: string;

  @ApiProperty({ description: 'Member being added to the group' })
  @IsUUID()
  memberId: string;

  @ApiPropertyOptional({ enum: SMALL_GROUP_ROLES, default: 'member' })
  @IsOptional()
  @IsIn(SMALL_GROUP_ROLES)
  role?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  joinedAt?: string;
}
