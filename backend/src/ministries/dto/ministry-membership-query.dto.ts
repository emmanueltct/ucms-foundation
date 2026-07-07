import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const MINISTRY_ROLES = ['leader', 'volunteer', 'member'] as const;

export class MinistryMembershipQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to volunteers of this ministry' })
  @IsOptional()
  @IsUUID()
  ministryId?: string;

  @ApiPropertyOptional({ description: "Filter to one member's memberships" })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({ enum: MINISTRY_ROLES })
  @IsOptional()
  @IsIn(MINISTRY_ROLES)
  role?: string;
}
