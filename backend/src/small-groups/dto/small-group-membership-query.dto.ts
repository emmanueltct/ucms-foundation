import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const SMALL_GROUP_ROLES = ['leader', 'co_leader', 'member'] as const;

export class SmallGroupMembershipQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to members of this small group' })
  @IsOptional()
  @IsUUID()
  smallGroupId?: string;

  @ApiPropertyOptional({ description: "Filter to one member's memberships" })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({ enum: SMALL_GROUP_ROLES })
  @IsOptional()
  @IsIn(SMALL_GROUP_ROLES)
  role?: string;
}
