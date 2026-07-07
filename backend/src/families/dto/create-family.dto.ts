import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateFamilyDto {
  @ApiProperty({ example: 'The Uwimana Family' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'KG 7 Ave, Kigali' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+250780000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
