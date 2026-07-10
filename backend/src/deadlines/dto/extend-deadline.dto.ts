import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';
import { RequireReasonDto } from '../../common/dto/require-reason.dto';

export class ExtendDeadlineDto extends RequireReasonDto {
  @ApiProperty({ example: '2026-08-12T00:00:00.000Z', description: 'The new due date — must resolve to a future date for the deadline to become open again.' })
  @IsDateString()
  dueAt: string;
}
