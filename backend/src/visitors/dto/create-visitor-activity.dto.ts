import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateVisitorActivityDto {
  @ApiProperty({
    example: 'follow_up',
    description:
      'Free-form key matching a ConfigItem in namespace "visitor_activity_type" (e.g. first_visit, counseling, prayer, follow_up, evangelism, home_visit, baptism_class, marriage_class, deliverance, bible_study, outreach, conference, or a custom type this church defines). Determines which custom fields (visitor_activity:{activityType}) apply.',
  })
  @IsString()
  activityType: string;

  @ApiPropertyOptional({ description: 'Defaults to now if omitted' })
  @IsOptional()
  @IsDateString()
  activityDate?: string;

  @ApiPropertyOptional({ example: 'Prayed with the family, will follow up next week.' })
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'This tenant\'s custom fields for "visitor_activity:{activityType}" (see GET /custom-field-definitions?entityType=visitor_activity:baptism_class), keyed by fieldKey.',
    example: { class_completed: true, certificate_number: 'BC-0042' },
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
