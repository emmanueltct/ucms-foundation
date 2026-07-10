import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateDynamicModuleDefinitionDto } from './create-dynamic-module-definition.dto';

export class UpdateDynamicModuleDefinitionDto extends PartialType(OmitType(CreateDynamicModuleDefinitionDto, ['key'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
