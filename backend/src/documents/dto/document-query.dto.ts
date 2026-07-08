import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class DocumentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to documents at this branch' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by ConfigItem key, e.g. "policy"' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Matches against title or description, case-insensitive' })
  @IsOptional()
  @IsString()
  search?: string;
}
