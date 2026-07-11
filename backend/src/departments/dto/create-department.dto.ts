import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Finance' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Parent department, for sub-departments' })
  @IsOptional()
  @IsUUID()
  parentDepartmentId?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
