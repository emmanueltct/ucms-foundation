import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/** Cross-record audit trail listing over the already-existing `DynamicModuleRecordStatusHistory` — no new audit mechanism (§15). */
export class StatusHistoryQueryDto {
  @ApiPropertyOptional({ description: 'Restrict to one form/module (DynamicModuleDefinition.id)' })
  @IsOptional()
  @IsUUID()
  moduleDefinitionId?: string;

  @ApiPropertyOptional({ description: 'Restrict to one specific record' })
  @IsOptional()
  @IsUUID()
  recordId?: string;

  @ApiPropertyOptional({ description: 'Restrict to changes made by one user' })
  @IsOptional()
  @IsUUID()
  changedByUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
