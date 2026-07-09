import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateVisitorGroupDto {
  @ApiProperty({ example: 'Kigali Baptist Youth Choir' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'choir_visit',
    description: 'Free-form key matching a ConfigItem in namespace "visitor_group_type" (e.g. family, delegation, choir_visit, conference_visitors, mission_team)',
  })
  @IsString()
  groupType: string;

  @ApiPropertyOptional({ description: 'Which branch/service they visited — omit if the church has only one location' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ example: '2026-07-12' })
  @IsDateString()
  visitDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional({ example: 25, description: 'Approximate headcount, if individual members are not each recorded' })
  @IsOptional()
  @IsPositive()
  @IsInt()
  expectedSize?: number;

  @ApiPropertyOptional({ example: 'event', description: 'Free-form key matching a ConfigItem in namespace "visitor_source"' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'User responsible for hosting/following up with this group' })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
