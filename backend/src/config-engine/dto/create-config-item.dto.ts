import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Matches } from 'class-validator';

export class CreateConfigItemDto {
  @ApiProperty({ example: 'contribution_type', description: 'lowercase snake_case grouping, e.g. "contribution_type"' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'namespace must be lowercase snake_case, e.g. "contribution_type"',
  })
  namespace: string;

  @ApiProperty({ example: 'tithe', description: 'stable machine key, lowercase snake_case' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'key must be lowercase snake_case, e.g. "tithe"' })
  key: string;

  @ApiProperty({ example: 'Tithe' })
  @IsString()
  label: string;

  @ApiProperty({ type: Object, example: {}, description: 'Arbitrary JSON payload owned by the consuming module — an empty object is valid for a label-only lookup value' })
  @IsObject()
  value: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
