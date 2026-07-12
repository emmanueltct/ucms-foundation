import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class AssignBranchResourceDto {
  @ApiProperty({ example: 'module', description: '"module" | "report" | "dashboard" | "workflow" | "document_category" | "dynamic_module_definition" (a form/report, §12) | ...' })
  @IsString()
  resourceType: string;

  @ApiProperty({ description: 'The resource identifier — a DynamicModuleDefinition.id, a report slug, etc., depending on resourceType' })
  @IsString()
  resourceKey: string;

  @ApiPropertyOptional({ description: 'Submission deadline (§14) — only meaningful when resourceType is "dynamic_module_definition"' })
  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}
