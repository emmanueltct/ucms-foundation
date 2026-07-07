import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Financial records are corrected by voiding, not editing (see
 * docs/finance/business-analysis.md) — only these two non-financial fields
 * are mutable in place.
 */
export class UpdateContributionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptNumber?: string;
}
