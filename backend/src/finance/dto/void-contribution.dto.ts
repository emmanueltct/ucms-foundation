import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoidContributionDto {
  @ApiProperty({ example: 'Duplicate entry — same gift recorded twice' })
  @IsString()
  @IsNotEmpty()
  voidReason: string;
}
