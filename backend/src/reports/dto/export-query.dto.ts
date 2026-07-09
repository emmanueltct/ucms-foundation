import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ReportQueryDto } from './report-query.dto';

const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;

export class ExportQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({ enum: EXPORT_FORMATS, default: 'csv' })
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: 'csv' | 'xlsx' | 'pdf';
}
