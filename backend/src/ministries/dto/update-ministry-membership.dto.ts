import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

const MINISTRY_ROLES = ['leader', 'volunteer', 'member'] as const;

/** Ministry/member cannot be changed here — remove and re-add to move a membership to a different ministry. */
export class UpdateMinistryMembershipDto {
  @ApiPropertyOptional({ enum: MINISTRY_ROLES })
  @IsOptional()
  @IsIn(MINISTRY_ROLES)
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
