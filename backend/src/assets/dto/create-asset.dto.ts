import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

const ASSET_STATUSES = ['in_use', 'in_storage', 'under_maintenance', 'disposed', 'lost'] as const;

export class CreateAssetDto {
  @ApiProperty({ example: 'Toyota Hiace — Youth Van' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'vehicle',
    description:
      'Free-form key matching a ConfigItem in namespace "asset_category". Fixed after creation — it determines which custom fields (asset:{category}) apply to this asset.',
  })
  @IsString()
  assetCategory: string;

  @ApiPropertyOptional({ description: 'Which branch/location holds this asset — omit for a church-wide asset' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ example: 'VEH-0003', description: 'Optional human/barcode identifier, unique per tenant' })
  @IsOptional()
  @IsString()
  assetTag?: string;

  @ApiPropertyOptional({ example: 'good', description: 'Free-form key matching a ConfigItem in namespace "asset_condition"' })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional({ enum: ASSET_STATUSES, default: 'in_use' })
  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: string;

  @ApiPropertyOptional({ example: 'Main campus — garage' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: '2024-03-01' })
  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @ApiPropertyOptional({ example: 18000000 })
  @IsOptional()
  @IsPositive()
  @IsNumber()
  acquisitionCost?: number;

  @ApiPropertyOptional({ example: 15000000, description: 'Current estimated value, if tracked separately from acquisition cost' })
  @IsOptional()
  @IsPositive()
  @IsNumber()
  currentValue?: number;

  @ApiPropertyOptional({ example: 'RWF', description: "Defaults to the tenant's currency if an acquisitionCost/currentValue is given" })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'This tenant\'s custom fields for "asset:{assetCategory}" (see GET /custom-field-definitions?entityType=asset:vehicle), keyed by fieldKey. File-type fields are set separately via POST /assets/:id/documents, not here.',
    example: { license_plate: 'RAD 123 A', mileage_km: 42000 },
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
