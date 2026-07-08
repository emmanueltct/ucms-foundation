import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'terminated'] as const;

export class StaffQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to staff at this branch' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: EMPLOYMENT_STATUSES })
  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES)
  employmentStatus?: string;
}
