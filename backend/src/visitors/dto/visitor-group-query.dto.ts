import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const VISITOR_GROUP_STATUSES = ['new', 'contacted', 'scheduled_visit', 'no_response', 'closed'] as const;

export class VisitorGroupQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to groups that visited this branch' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by ConfigItem key in namespace "visitor_group_type"' })
  @IsOptional()
  @IsString()
  groupType?: string;

  @ApiPropertyOptional({ enum: VISITOR_GROUP_STATUSES })
  @IsOptional()
  @IsIn(VISITOR_GROUP_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: 'Matches against name, contact name, phone, or email, case-insensitive' })
  @IsOptional()
  @IsString()
  search?: string;
}
