import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ example: 'Board Meeting Minutes — March 2026' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'minutes', description: 'Free-form key matching a ConfigItem in namespace "document_category"' })
  @IsString()
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Which branch this document belongs to — omit for a church-wide document' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
