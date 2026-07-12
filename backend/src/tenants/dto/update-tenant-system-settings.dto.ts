import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** §18's "System Settings" Configuration Center page — the same `Tenant` columns TenantsService already sets at creation time, editable afterward. */
export class UpdateTenantSystemSettingsDto {
  @ApiPropertyOptional({ example: 'RWF' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: 'Africa/Kigali' })
  @IsOptional()
  @IsString()
  timezone?: string;
}
