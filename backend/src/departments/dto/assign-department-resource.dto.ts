import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class AssignDepartmentResourceDto {
  @ApiProperty({ example: 'module', description: '"module" | "report" | "dashboard" | "workflow" | "document_category" | "dynamic_module_definition"' })
  @IsString()
  resourceType: string;

  @ApiProperty({ description: 'The resource identifier — e.g. a DynamicModuleDefinition.id for resourceType "module"' })
  @IsString()
  resourceKey: string;

  @ApiProperty({ required: false, description: 'Optional submission deadline, only meaningful when resourceType is "dynamic_module_definition"' })
  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}
