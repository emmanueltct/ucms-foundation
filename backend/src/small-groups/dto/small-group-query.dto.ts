import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class SmallGroupQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to groups scoped to this branch' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by ConfigItem key, e.g. "sunday_school"' })
  @IsOptional()
  @IsString()
  groupType?: string;

  @ApiPropertyOptional({ description: 'Matches against name, case-insensitive' })
  @IsOptional()
  @IsString()
  search?: string;
}
