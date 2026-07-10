import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateHierarchyRequirementDto } from './create-hierarchy-requirement.dto';

export class UpdateHierarchyRequirementDto extends PartialType(CreateHierarchyRequirementDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
