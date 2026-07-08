import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const STATUSES = ['pending', 'paid', 'cancelled'] as const;

export class PayrollPaymentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter to one staff member's payments" })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: string;
}
