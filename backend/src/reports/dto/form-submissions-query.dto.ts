import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ReportQueryDto } from './report-query.dto';

const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;

/**
 * §15's "filter by date/branch/department/leader/status" over the same
 * `DynamicModuleRecord` rows §14 assigns deadlines to — "department" is
 * expressed the same way a submission already links back to one:
 * `attachedToEntityType`/`attachedToEntityId` (e.g. "dynamic_module_record" +
 * a Departments-module record id), not a new column.
 */
export class FormSubmissionsQueryDto extends ReportQueryDto {
  @ApiProperty({ description: 'Which form/report (DynamicModuleDefinition.id) to summarize' })
  @IsUUID()
  moduleDefinitionId: string;

  @ApiPropertyOptional({ description: 'e.g. "dynamic_module_record" to filter to submissions attached to one department/ministry/etc.' })
  @IsOptional()
  attachedToEntityType?: string;

  @ApiPropertyOptional({ description: 'The scoped entity id — a department record id, a small group id, etc.' })
  @IsOptional()
  @IsUUID()
  attachedToEntityId?: string;

  @ApiPropertyOptional({ description: 'Restrict to submissions created by one user (the "leader"/submitter)' })
  @IsOptional()
  @IsUUID()
  createdByUserId?: string;
}

export class ExportFormSubmissionsQueryDto extends FormSubmissionsQueryDto {
  @ApiPropertyOptional({ enum: EXPORT_FORMATS, default: 'csv' })
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: 'csv' | 'xlsx' | 'pdf';
}
