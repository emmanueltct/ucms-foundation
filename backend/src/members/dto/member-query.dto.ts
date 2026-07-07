import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const MEMBERSHIP_STATUSES = ['active', 'inactive', 'transferred', 'deceased'] as const;

export class MemberQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to members in this branch' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter to members in this family' })
  @IsOptional()
  @IsUUID()
  familyId?: string;

  @ApiPropertyOptional({ enum: MEMBERSHIP_STATUSES })
  @IsOptional()
  @IsIn(MEMBERSHIP_STATUSES)
  membershipStatus?: string;
}
