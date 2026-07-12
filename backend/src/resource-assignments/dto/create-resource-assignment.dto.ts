import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class CreateResourceAssignmentDto {
  @ApiProperty({ example: 'branch', description: 'What kind of org unit this is scoped to, e.g. "branch" | "branch_type" | "dynamic_module_record"' })
  @IsString()
  scopeEntityType: string;

  @ApiProperty({ description: "The scoped entity's row id (a real UUID — e.g. a Branch.id, or a branch_type ConfigItem.id)" })
  @IsString()
  scopeEntityId: string;

  @ApiProperty({ example: 'module', description: 'What kind of resource is being attached, e.g. "module" | "report" | "dashboard" | "workflow" | "document_category"' })
  @IsString()
  resourceType: string;

  @ApiProperty({ description: 'The resource identifier — a DynamicModuleDefinition.id, a report key, etc., depending on resourceType' })
  @IsString()
  resourceKey: string;

  @ApiPropertyOptional({ description: 'Submission deadline for this specific assignment (§14) — omit for no deadline' })
  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}
