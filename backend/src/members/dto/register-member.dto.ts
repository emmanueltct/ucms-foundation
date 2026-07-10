import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

const GENDERS = ['male', 'female', 'other'] as const;

/**
 * The public, unauthenticated self-registration form — a deliberately
 * smaller field set than `CreateMemberDto` (no membership number, category,
 * or status — the server always creates these as `pending`). See
 * docs/member-registration/business-analysis.md.
 */
export class RegisterMemberDto {
  @ApiProperty({ description: 'The Church/Branch/Parish/Cell/Work Group being joined' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Uwimana' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ enum: GENDERS })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: string;

  @ApiPropertyOptional({ example: '1990-04-12' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: '+250780000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'jean@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'KG 7 Ave, Kigali' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'This tenant\'s custom fields for "member" (see GET /custom-field-definitions?entityType=member), keyed by fieldKey.',
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
