import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

const REQUIREMENT_KINDS = ['report', 'document', 'form', 'activity', 'compliance'] as const;
const FREQUENCIES = ['once', 'monthly', 'quarterly', 'annually'] as const;

export class CreateHierarchyRequirementDto {
  @ApiProperty({ example: 'diocese', description: 'Free-form key matching a ConfigItem in namespace "branch_type" — the level defining this requirement.' })
  @IsString()
  parentBranchType: string;

  @ApiProperty({ example: 'district', description: 'Free-form key matching a ConfigItem in namespace "branch_type" — the level this requirement applies to.' })
  @IsString()
  childBranchType: string;

  @ApiProperty({ enum: REQUIREMENT_KINDS })
  @IsIn(REQUIREMENT_KINDS)
  kind: string;

  @ApiProperty({ example: 'Monthly activity report' })
  @IsString()
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: FREQUENCIES, default: 'once', description: 'Informational only — the concrete due date for each cycle is set per submission.' })
  @IsOptional()
  @IsIn(FREQUENCIES)
  frequency?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 31, description: 'Informational only, e.g. "the 5th of every month."' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDayOfPeriod?: number;

  @ApiPropertyOptional({ description: 'An ApprovalWorkflow (entityType "hierarchy_requirement_submission") each submission must pass — omit for no approval step.' })
  @IsOptional()
  @IsUUID()
  approvalWorkflowId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Role names to notify when a new submission cycle opens.' })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  notifyRoleNames?: string[];
}
