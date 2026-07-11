import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Finance Officer' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Manages contributions and expense approvals' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['finance.contribution.create', 'finance.contribution.read'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];

  @ApiPropertyOptional({ default: false, description: 'Whether a Department Leader may assign this role to staff within their own department.' })
  @IsOptional()
  @IsBoolean()
  isDelegable?: boolean;
}
