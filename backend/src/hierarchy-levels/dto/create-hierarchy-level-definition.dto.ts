import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateHierarchyLevelDefinitionDto {
  @ApiProperty({ example: 'district', description: 'A ConfigItem key in namespace "branch_type"' })
  @IsString()
  branchTypeKey: string;

  @ApiProperty({ example: 'District' })
  @IsString()
  label: string;

  @ApiPropertyOptional({ type: [String], description: 'Which branchType keys may be this level\'s parent — empty allows any (or none).' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedParentTypeKeys?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Which branchType keys may be this level\'s child — empty allows any.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedChildTypeKeys?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: '#2563EB', description: "This tier's color in the org-chart tree UI — omit to use the frontend's depth-based default rotation" })
  @IsOptional()
  @IsString()
  color?: string;
}
