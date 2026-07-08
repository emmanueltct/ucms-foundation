import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select', 'file'] as const;

export class CustomFieldOptionDto {
  @ApiProperty({ example: 'confirmed' })
  @IsString()
  key: string;

  @ApiProperty({ example: 'Confirmed' })
  @IsString()
  label: string;
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
  fieldType: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'file';

  @ApiPropertyOptional({ type: [CustomFieldOptionDto], description: 'Required when fieldType is "select"' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldOptionDto)
  options?: CustomFieldOptionDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
