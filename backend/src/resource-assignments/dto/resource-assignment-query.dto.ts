import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResourceAssignmentQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scopeEntityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scopeEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ description: 'Restrict to one specific resource — e.g. every scope a given form/module is assigned to.' })
  @IsOptional()
  @IsString()
  resourceKey?: string;
}
