import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignDepartmentResourceDto {
  @ApiProperty({ example: 'module', description: '"module" | "report" | "dashboard" | "workflow" | "document_category"' })
  @IsString()
  resourceType: string;

  @ApiProperty({ description: 'The resource identifier — e.g. a DynamicModuleDefinition.id for resourceType "module"' })
  @IsString()
  resourceKey: string;
}
