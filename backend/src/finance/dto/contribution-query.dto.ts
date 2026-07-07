import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'mobile_money', 'cheque', 'other'] as const;

export class ContributionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to contributions received at this branch' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter to contributions from this member' })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({ description: 'Filter by ConfigItem key, e.g. "tithe"' })
  @IsOptional()
  @IsString()
  contributionType?: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Inclusive lower bound on contributedAt' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Inclusive upper bound on contributedAt' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ default: false, description: 'Include voided contributions in results/totals' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeVoided?: boolean = false;
}
