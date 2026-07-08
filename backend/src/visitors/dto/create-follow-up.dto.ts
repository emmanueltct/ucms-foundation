import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateFollowUpDto {
  @ApiProperty({ example: 'call', description: 'Free-form key matching a ConfigItem in namespace "follow_up_method"' })
  @IsString()
  method: string;

  @ApiPropertyOptional({ description: 'Defaults to now if omitted' })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiPropertyOptional({ example: 'Left a voicemail, will try again Thursday.' })
  @IsOptional()
  @IsString()
  outcome?: string;
}
