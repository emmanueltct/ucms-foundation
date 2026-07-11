import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const CHANNELS = ['email', 'sms', 'push'] as const;

export class CreateNotificationTemplateDto {
  @ApiProperty({ enum: CHANNELS })
  @IsIn(CHANNELS)
  channel: 'email' | 'sms' | 'push';

  @ApiProperty({ example: 'welcome_new_member' })
  @IsString()
  key: string;

  @ApiPropertyOptional({ example: 'Welcome to {{churchName}}!' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ example: 'Hi {{firstName}}, welcome to {{churchName}}. We\'re glad you\'re here.' })
  @IsString()
  body: string;
}
