import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Kigali Baptist Church' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'kigali-baptist', description: 'Used as kigali-baptist.ucms.app' })
  @IsString()
  @MinLength(2)
  slug: string;

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

  @ApiPropertyOptional({ enum: ['free', 'starter', 'growth', 'enterprise'] })
  @IsOptional()
  @IsIn(['free', 'starter', 'growth', 'enterprise'])
  subscriptionPlan?: string;

  @ApiPropertyOptional({ description: 'If provided, bootstraps the first Church Administrator user' })
  @IsOptional()
  @IsEmail()
  adminEmail?: string;
}
