import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class CreatePayrollPaymentDto {
  @ApiProperty({ description: 'Staff member being paid' })
  @IsUUID()
  staffId: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsDateString()
  periodEnd: string;

  @ApiProperty({ example: 250000 })
  @IsPositive()
  grossAmount: number;

  @ApiPropertyOptional({ example: 15000, default: 0 })
  @IsOptional()
  @Min(0)
  deductions?: number;

  @ApiPropertyOptional({ example: 'RWF', description: "Defaults to the staff member's salaryCurrency, then the tenant's currency" })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
