import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

const GENDERS = ['male', 'female', 'other'] as const;
const FAMILY_ROLES = ['head', 'spouse', 'child', 'dependent', 'other'] as const;
const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed', 'other'] as const;
const MEMBERSHIP_STATUSES = ['active', 'inactive', 'transferred', 'deceased'] as const;

export class CreateMemberDto {
  @ApiProperty({ description: 'Branch this member belongs to' })
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional({ description: 'Family/household this member belongs to' })
  @IsOptional()
  @IsUUID()
  familyId?: string;

  @ApiPropertyOptional({ enum: FAMILY_ROLES })
  @IsOptional()
  @IsIn(FAMILY_ROLES)
  familyRole?: string;

  @ApiPropertyOptional({ example: 'MBR-0001' })
  @IsOptional()
  @IsString()
  membershipNumber?: string;

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

  @ApiPropertyOptional({ enum: MARITAL_STATUSES })
  @IsOptional()
  @IsIn(MARITAL_STATUSES)
  maritalStatus?: string;

  @ApiPropertyOptional({
    example: 'full_member',
    description: 'Free-form key matching a ConfigItem in namespace "membership_category"',
  })
  @IsOptional()
  @IsString()
  membershipCategory?: string;

  @ApiPropertyOptional({ enum: MEMBERSHIP_STATUSES, default: 'active' })
  @IsOptional()
  @IsIn(MEMBERSHIP_STATUSES)
  membershipStatus?: string;

  @ApiPropertyOptional({ example: '2020-01-15' })
  @IsOptional()
  @IsDateString()
  joinedAt?: string;

  @ApiPropertyOptional({ example: '2005-06-01' })
  @IsOptional()
  @IsDateString()
  baptismDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'This tenant\'s custom fields for "member" (see GET /custom-field-definitions?entityType=member), keyed by fieldKey.',
    example: { confirmation_date: '2020-06-01', spiritual_gift: 'teaching' },
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
