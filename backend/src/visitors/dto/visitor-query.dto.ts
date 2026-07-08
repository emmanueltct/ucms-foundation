import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const VISITOR_STATUSES = ['new', 'contacted', 'scheduled_visit', 'joined', 'no_response', 'closed'] as const;

export class VisitorQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to visitors at this branch' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: VISITOR_STATUSES })
  @IsOptional()
  @IsIn(VISITOR_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter to visitors assigned to this user for follow-up' })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional({ description: 'Matches against name, phone, or email, case-insensitive' })
  @IsOptional()
  @IsString()
  search?: string;
}
