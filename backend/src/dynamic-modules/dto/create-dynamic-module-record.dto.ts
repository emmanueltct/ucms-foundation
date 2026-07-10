import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class CreateDynamicModuleRecordDto {
  @ApiPropertyOptional({ description: 'Required together with attachedToEntityId — omit both for a standalone record.' })
  @ValidateIf((o) => o.attachedToEntityId !== undefined)
  @IsString()
  attachedToEntityType?: string;

  @ApiPropertyOptional({ description: 'Required together with attachedToEntityType — omit both for a standalone record.' })
  @ValidateIf((o) => o.attachedToEntityType !== undefined)
  @IsString()
  attachedToEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
