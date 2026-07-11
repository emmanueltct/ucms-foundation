import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * The public, unauthenticated self-registration form — a deliberately
 * smaller field set than `CreateVisitorDto` (no visitorGroupId,
 * invitedByMemberId, or assignedToUserId — admin-only concerns), mirroring
 * `RegisterMemberDto`'s "public form, server controls the rest" shape.
 */
export class RegisterVisitorDto {
  @ApiProperty({ description: 'Which branch/service they visited' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ example: 'Alice' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Uwase' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: '2026-07-05' })
  @IsDateString()
  visitDate: string;

  @ApiPropertyOptional({ example: 'friend_family', description: 'Free-form key matching a ConfigItem in namespace "visitor_source"' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
