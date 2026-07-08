import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const REGISTRATION_STATUSES = ['registered', 'attended', 'cancelled'] as const;

/** eventId/memberId are immutable — cancel and re-register to move a registration to a different event. */
export class UpdateEventRegistrationDto {
  @ApiPropertyOptional({ enum: REGISTRATION_STATUSES })
  @IsOptional()
  @IsIn(REGISTRATION_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
