import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVisitorDto {
  @ApiProperty({ example: 'Alice' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Uwase' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ description: 'Which branch/service they visited — omit if the church has only one location' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'The delegation/family/group this visitor arrived with, if any' })
  @IsOptional()
  @IsUUID()
  visitorGroupId?: string;

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

  @ApiPropertyOptional({ description: 'The member who invited this visitor, if known' })
  @IsOptional()
  @IsUUID()
  invitedByMemberId?: string;

  @ApiPropertyOptional({ description: 'User responsible for following up with this visitor' })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
