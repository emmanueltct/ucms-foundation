import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'mobile_money', 'cheque', 'other'] as const;

export class CreateContributionDto {
  @ApiProperty({ description: 'Branch where this contribution was received' })
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional({ description: 'Member who gave this contribution — omit for anonymous/cash-basket giving' })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiProperty({
    example: 'tithe',
    description: 'Free-form key matching a ConfigItem in namespace "contribution_type"',
  })
  @IsString()
  contributionType: string;

  @ApiProperty({ example: 25000, description: 'Must be greater than 0' })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'RWF', description: "Defaults to the tenant's current currency" })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  paymentMethod: string;

  @ApiPropertyOptional({ example: 'RCT-0001' })
  @IsOptional()
  @IsString()
  receiptNumber?: string;

  @ApiProperty({ example: '2026-07-05' })
  @IsDateString()
  contributedAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
