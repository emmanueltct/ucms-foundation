import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateHierarchyLevelDefinitionDto } from './create-hierarchy-level-definition.dto';

export class UpdateHierarchyLevelDefinitionDto extends PartialType(OmitType(CreateHierarchyLevelDefinitionDto, ['branchTypeKey'] as const)) {}
