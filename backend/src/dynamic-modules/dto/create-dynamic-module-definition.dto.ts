import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateDynamicModuleDefinitionDto {
  @ApiProperty({ example: 'committee-requests', description: 'Stable machine key — lowercase letters, numbers, and hyphens only.' })
  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/, { message: 'key must be lowercase letters, numbers, and hyphens, starting with a letter.' })
  key: string;

  @ApiProperty({ example: 'Committee Requests' })
  @IsString()
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'clipboard-list', description: 'A lucide-react icon name the frontend maps to.' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ type: [String], description: 'Which existing entityType strings a record of this module may attach to — informational only.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachableToEntityTypes?: string[];

  @ApiPropertyOptional({ type: [String], default: ['open', 'closed'], description: 'Ordered status labels — the first is the default a new record starts in.' })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  statuses?: string[];

  @ApiPropertyOptional({ description: 'An ApprovalWorkflow every status change on this module\'s records must pass through — omit for direct status changes.' })
  @IsOptional()
  @IsUUID()
  approvalWorkflowId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  showInNav?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Whether an unauthenticated caller may submit a new record via POST /modules/:key/submit.' })
  @IsOptional()
  @IsBoolean()
  allowPublicSubmission?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Whether this module\'s record page shows the "attach Members" panel — off for modules with no reason to attach church members.' })
  @IsOptional()
  @IsBoolean()
  allowMemberAttachment?: boolean;
}
