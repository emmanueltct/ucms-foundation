import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CustomFieldDefinitionQueryDto {
  @ApiPropertyOptional({ description: 'Filter to fields defined for this entity type, e.g. "member"' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean = false;
}
