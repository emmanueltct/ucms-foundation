import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const CHANNELS = ['email', 'sms', 'push'] as const;
const STATUSES = ['queued', 'sent', 'failed'] as const;

export class NotificationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CHANNELS })
  @IsOptional()
  @IsIn(CHANNELS)
  channel?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: "Filter to one member's notifications" })
  @IsOptional()
  @IsUUID()
  memberId?: string;
}
