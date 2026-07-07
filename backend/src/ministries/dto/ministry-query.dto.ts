import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class MinistryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to ministries scoped to this branch' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by ConfigItem key, e.g. "youth"' })
  @IsOptional()
  @IsString()
  ministryType?: string;
}
