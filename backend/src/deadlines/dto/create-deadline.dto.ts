import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString } from 'class-validator';

export class CreateDeadlineDto {
  @ApiProperty({ example: 'hierarchy_requirement_submission', description: 'Which kind of record this deadline gates.' })
  @IsString()
  entityType: string;

  @ApiProperty({ description: 'The specific record this deadline applies to.' })
  @IsString()
  entityId: string;

  @ApiProperty({ example: '2026-08-05T00:00:00.000Z' })
  @IsDateString()
  dueAt: string;
}
