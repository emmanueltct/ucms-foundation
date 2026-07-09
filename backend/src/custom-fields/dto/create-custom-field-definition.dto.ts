import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const FIELD_TYPES = [
  'text',
  'richtext',
  'number',
  'date',
  'time',
  'boolean',
  'select',
  'radio',
  'multiselect',
  'email',
  'phone',
  'address',
  'gps',
  'file',
  'image',
  'video',
  'audio',
  'signature',
  'lookup',
] as const;

export type CustomFieldType = (typeof FIELD_TYPES)[number];

export class CustomFieldOptionDto {
  @ApiProperty({ example: 'confirmed' })
  @IsString()
  key: string;

  @ApiProperty({ example: 'Confirmed' })
  @IsString()
  label: string;
}

export class CustomFieldValidationRulesDto {
  @ApiPropertyOptional({ description: 'text/richtext/phone/address: minimum character length' })
  @IsOptional()
  @IsInt()
  minLength?: number;

  @ApiPropertyOptional({ description: 'text/richtext/phone/address: maximum character length' })
  @IsOptional()
  @IsInt()
  maxLength?: number;

  @ApiPropertyOptional({ description: 'number: minimum value' })
  @IsOptional()
  min?: number;

  @ApiPropertyOptional({ description: 'number: maximum value' })
  @IsOptional()
  max?: number;

  @ApiPropertyOptional({ description: 'text/richtext/phone/address: a regular expression the value must match' })
  @IsOptional()
  @IsString()
  pattern?: string;
}

export class CreateCustomFieldDefinitionDto {
  @ApiProperty({ example: 'member', description: 'Which entity this field attaches to' })
  @IsString()
  entityType: string;

  @ApiProperty({ example: 'confirmation_date', description: 'Stable machine key — cannot be changed after creation' })
  @IsString()
  fieldKey: string;

  @ApiProperty({ example: 'Confirmation Date' })
  @IsString()
  label: string;

  @ApiProperty({ enum: FIELD_TYPES })
  @IsIn(FIELD_TYPES)
  fieldType: CustomFieldType;

  @ApiPropertyOptional({ type: [CustomFieldOptionDto], description: 'Required when fieldType is "select", "radio", or "multiselect"' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldOptionDto)
  options?: CustomFieldOptionDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: 0, description: 'Controls both field order and, indirectly, section order (fields are grouped by section, sections ordered by their first field)' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: 'Contact Info', description: 'Optional section heading this field is grouped under on the form' })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional({ type: [String], description: 'Role names allowed to see this field; empty/omitted = every role' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleToRoleNames?: string[];

  @ApiPropertyOptional({ type: CustomFieldValidationRulesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CustomFieldValidationRulesDto)
  validationRules?: CustomFieldValidationRulesDto;

  @ApiPropertyOptional({ example: 'member', description: 'Required when fieldType is "lookup" — which entityType this field references' })
  @IsOptional()
  @IsString()
  lookupEntityType?: string;
}
