import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

const CHANNELS = ['email', 'sms', 'push'] as const;

export class CreateNotificationDto {
  @ApiProperty({ enum: CHANNELS })
  @IsIn(CHANNELS)
  channel: 'email' | 'sms' | 'push';

  @ApiPropertyOptional({ description: "Send to this member's email/phone on file — omit for push, or to use an explicit recipient" })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({
    description:
      'Explicit address/token to send to. Required for "push" (no device-token registry exists yet) and for any ' +
      'channel when memberId is omitted or the member has no matching contact field on file.',
  })
  @IsOptional()
  @IsString()
  recipient?: string;

  @ApiPropertyOptional({ description: 'Used for email; ignored for sms/push' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'When given, subject/body are resolved from this NotificationTemplate key instead — subject/body below become optional and are ignored if the template exists.' })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @ApiPropertyOptional({ description: 'Values substituted into the template\'s {{placeholder}} tokens' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @ApiPropertyOptional({ example: 'Service starts at 9am this Sunday.', description: 'Required unless templateKey resolves to an existing template' })
  @IsOptional()
  @IsString()
  body?: string;
}
