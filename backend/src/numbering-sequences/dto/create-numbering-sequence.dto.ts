import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateNumberingSequenceDto {
  @ApiProperty({ example: 'member_membership_number' })
  @IsString()
  key: string;

  @ApiPropertyOptional({ example: 'MEM-' })
  @IsOptional()
  @IsString()
  prefix?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  nextValue?: number;

  @ApiPropertyOptional({ default: 4, minimum: 1, description: 'Zero-padding width, e.g. padding 4 -> 0007' })
  @IsOptional()
  @IsInt()
  @Min(1)
  padding?: number;
}
