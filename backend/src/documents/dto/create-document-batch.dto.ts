import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDocumentBatchDto {
  @ApiProperty({ example: 'minutes', description: 'Free-form key matching a ConfigItem in namespace "document_category" — shared by every file in this batch' })
  @IsString()
  category: string;

  @ApiPropertyOptional({
    example: 'Board Meeting Photos',
    description: 'Prepended to each file\'s own name to form its title (e.g. "Board Meeting Photos — IMG_001.jpg"). Omit to title each document after its filename alone.',
  })
  @IsOptional()
  @IsString()
  titlePrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Which branch these documents belong to — omit for church-wide documents' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
