import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const REGISTRATION_STATUSES = ['registered', 'attended', 'cancelled'] as const;

export class EventRegistrationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to registrations for this event' })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ description: "Filter to one member's registrations" })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({ enum: REGISTRATION_STATUSES })
  @IsOptional()
  @IsIn(REGISTRATION_STATUSES)
  status?: string;
}
