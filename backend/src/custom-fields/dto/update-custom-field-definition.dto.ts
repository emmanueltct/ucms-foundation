import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCustomFieldDefinitionDto } from './create-custom-field-definition.dto';

/**
 * `entityType`, `fieldKey`, and `fieldType` are immutable once created —
 * changing which entity a field belongs to, its stable key, or how its
 * value is interpreted would silently reinterpret every existing
 * `CustomFieldValue` row for it. Retire the field (isActive: false) and
 * create a new one instead.
 */
export class UpdateCustomFieldDefinitionDto extends PartialType(
  OmitType(CreateCustomFieldDefinitionDto, ['entityType', 'fieldKey', 'fieldType'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
