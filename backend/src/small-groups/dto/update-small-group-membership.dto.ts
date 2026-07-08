import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

const SMALL_GROUP_ROLES = ['leader', 'co_leader', 'member'] as const;

/** Group/member cannot be changed here — remove and re-add to move a membership to a different group. */
export class UpdateSmallGroupMembershipDto {
  @ApiPropertyOptional({ enum: SMALL_GROUP_ROLES })
  @IsOptional()
  @IsIn(SMALL_GROUP_ROLES)
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
