import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CompleteOnboardingDto {
  @ApiPropertyOptional({ description: 'Name for the auto-created headquarters branch; defaults to the tenant name' })
  @IsOptional()
  @IsString()
  headquartersName?: string;

  @ApiPropertyOptional({ example: 'headquarters', description: 'ConfigItem key in namespace "branch_type"' })
  @IsOptional()
  @IsString()
  headquartersType?: string;
}
