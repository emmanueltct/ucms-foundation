import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateMemberActivityDto {
  @ApiProperty({
    example: 'training_completed',
    description:
      'Free-form key matching a ConfigItem in namespace "member_activity_type" (e.g. baptism, communion, training_completed, certificate_earned, leadership_appointment, volunteer_work, counseling, or a custom type this church defines). Determines which custom fields (member_activity:{activityType}) apply.',
  })
  @IsString()
  activityType: string;

  @ApiPropertyOptional({ description: 'Defaults to now if omitted' })
  @IsOptional()
  @IsDateString()
  activityDate?: string;

  @ApiPropertyOptional({ example: 'Completed the 6-week leadership training with distinction.' })
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'This tenant\'s custom fields for "member_activity:{activityType}" (see GET /custom-field-definitions?entityType=member_activity:certificate_earned), keyed by fieldKey.',
    example: { certificate_number: 'CERT-0012' },
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
