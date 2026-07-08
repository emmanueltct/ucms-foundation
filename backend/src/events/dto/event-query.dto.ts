import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class EventQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to events hosted at this branch' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by ConfigItem key, e.g. "camp"' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ description: 'Inclusive lower bound on startsAt' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Inclusive upper bound on startsAt' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
