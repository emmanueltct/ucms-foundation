import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResourceAssignmentQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scopeEntityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scopeEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resourceType?: string;
}
