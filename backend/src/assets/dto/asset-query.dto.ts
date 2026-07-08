import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const ASSET_STATUSES = ['in_use', 'in_storage', 'under_maintenance', 'disposed', 'lost'] as const;

export class AssetQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to assets at this branch' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by ConfigItem key, e.g. "vehicle"' })
  @IsOptional()
  @IsString()
  assetCategory?: string;

  @ApiPropertyOptional({ enum: ASSET_STATUSES })
  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: 'Matches against name or assetTag, case-insensitive' })
  @IsOptional()
  @IsString()
  search?: string;
}
