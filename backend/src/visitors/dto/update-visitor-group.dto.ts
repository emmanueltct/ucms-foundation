import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateVisitorGroupDto } from './create-visitor-group.dto';

const VISITOR_GROUP_STATUSES = ['new', 'contacted', 'scheduled_visit', 'no_response', 'closed'] as const;

export class UpdateVisitorGroupDto extends PartialType(CreateVisitorGroupDto) {
  @ApiPropertyOptional({ enum: VISITOR_GROUP_STATUSES })
  @IsOptional()
  @IsIn(VISITOR_GROUP_STATUSES)
  status?: string;
}
