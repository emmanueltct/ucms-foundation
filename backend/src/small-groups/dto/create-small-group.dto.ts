import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsPositive, IsString, IsUUID, Matches } from 'class-validator';

const MEETING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export class CreateSmallGroupDto {
  @ApiProperty({ example: 'Kimironko Home Group' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Branch this group is scoped to — omit for a church-wide group' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    example: 'home_group',
    description: 'Free-form key matching a ConfigItem in namespace "small_group_type"',
  })
  @IsOptional()
  @IsString()
  groupType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: MEETING_DAYS })
  @IsOptional()
  @IsIn(MEETING_DAYS)
  meetingDay?: string;

  @ApiPropertyOptional({ example: '18:30', description: '24-hour "HH:mm"' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'meetingTime must be in 24-hour "HH:mm" format' })
  meetingTime?: string;

  @ApiPropertyOptional({ example: 'Uwase residence, Kimironko' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 15, description: 'Soft cap enforced when adding members — omit for unlimited' })
  @IsOptional()
  @IsPositive()
  @IsInt()
  capacity?: number;

  @ApiPropertyOptional({ example: 6, description: 'For a children\'s/youth class — the youngest age this group is for' })
  @IsOptional()
  @IsInt()
  minAge?: number;

  @ApiPropertyOptional({ example: 12, description: 'For a children\'s/youth class — the oldest age this group is for' })
  @IsOptional()
  @IsInt()
  maxAge?: number;
}
