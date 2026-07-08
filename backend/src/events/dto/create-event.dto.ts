import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Youth Camp 2026' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Branch hosting this event — omit for a church-wide event' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    example: 'camp',
    description: 'Free-form key matching a ConfigItem in namespace "event_type"',
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Kigali Convention Centre' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ example: '2026-08-15T09:00:00.000Z' })
  @IsDateString()
  startsAt: string;

  @ApiPropertyOptional({ example: '2026-08-15T17:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ description: 'Soft registration cap — omit for unlimited' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;
}
