import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateTenantBrandingDto {
  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;

  @ApiPropertyOptional({
    example: { primaryColor: '#1E2A44', secondaryColor: '#C9A24B' },
    description: 'Free-form key/value theme settings (colors, etc.) — rendered by the frontend, not validated here.',
  })
  @IsOptional()
  @IsObject()
  themeConfig?: Record<string, string>;

  @ApiPropertyOptional({ example: 'church.example.com' })
  @IsOptional()
  @IsString()
  customDomain?: string;
}
