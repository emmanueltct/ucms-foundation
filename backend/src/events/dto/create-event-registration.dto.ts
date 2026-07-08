import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEventRegistrationDto {
  @ApiProperty({ description: 'Event being registered for' })
  @IsUUID()
  eventId: string;

  @ApiPropertyOptional({ description: 'Registering member — omit for a walk-in guest (then guestName is required)' })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({ example: 'Alice Uwase', description: 'Required when memberId is omitted' })
  @IsOptional()
  @IsString()
  guestName?: string;

  @ApiPropertyOptional({ example: '+250780000001' })
  @IsOptional()
  @IsString()
  guestContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
