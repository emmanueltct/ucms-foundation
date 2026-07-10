import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

export class ApprovalStepInputDto {
  @ApiProperty({ example: 'District Coordinator approval' })
  @IsString()
  label: string;

  @ApiPropertyOptional({ description: 'Any user holding this role approves this step. Exactly one of role/permission must be set.' })
  @ValidateIf((s) => !s.approverPermissionCode)
  @IsString()
  approverRoleName?: string;

  @ApiPropertyOptional({ description: 'Any user holding this permission code approves this step. Exactly one of role/permission must be set.' })
  @ValidateIf((s) => !s.approverRoleName)
  @IsString()
  approverPermissionCode?: string;
}

export class CreateApprovalWorkflowDto {
  @ApiProperty({
    example: 'member_registration',
    description: 'Free-form key identifying what this workflow approves — the same string callers pass as entityType to startRequest/decide.',
  })
  @IsString()
  entityType: string;

  @ApiProperty({ example: 'Standard member approval' })
  @IsString()
  name: string;

  @ApiProperty({ type: [ApprovalStepInputDto], description: 'Ordered list of approval steps — position in the array is the step order.' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepInputDto)
  steps: ApprovalStepInputDto[];
}
