import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({ example: 'Kigali Central Parish' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Parent branch id — omit to create a root/HQ-level branch' })
  @IsOptional()
  @IsUUID()
  parentBranchId?: string;

  @ApiPropertyOptional({
    example: 'parish',
    description: 'Free-form key matching a ConfigItem in namespace "branch_type" (e.g. diocese, parish, district, cell)',
  })
  @IsOptional()
  @IsString()
  branchType?: string;

  @ApiPropertyOptional({ example: 'KGL-001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'KG 7 Ave, Kigali' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Marks this branch as the tenant\'s single headquarters (unsets any other)' })
  @IsOptional()
  @IsBoolean()
  isHeadquarters?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
