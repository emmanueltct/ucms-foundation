import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSubmissionDto {
  @ApiPropertyOptional({ example: '2026-07', description: 'Identifies which cycle this is for a recurring requirement — omit for a one-off requirement.' })
  @IsOptional()
  @IsString()
  periodLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitSubmissionDto {
  @ApiPropertyOptional({ type: [String], description: 'Document ids (from the Documents module) uploaded as evidence for this submission.' })
  @IsOptional()
  @IsUUID('4', { each: true })
  attachedDocumentIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
