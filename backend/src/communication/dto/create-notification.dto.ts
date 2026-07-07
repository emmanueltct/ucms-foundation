import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

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

  @ApiProperty({ example: 'Service starts at 9am this Sunday.' })
  @IsString()
  body: string;
}
