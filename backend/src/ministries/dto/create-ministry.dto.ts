import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMinistryDto {
  @ApiProperty({ example: 'Youth Ministry' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Branch this ministry is scoped to — omit for a church-wide ministry' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    example: 'youth',
    description: 'Free-form key matching a ConfigItem in namespace "ministry_type"',
  })
  @IsOptional()
  @IsString()
  ministryType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
