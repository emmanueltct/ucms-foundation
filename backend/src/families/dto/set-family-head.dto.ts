import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SetFamilyHeadDto {
  @ApiPropertyOptional({ description: 'Member id to set as head of family — omit/null to clear the head' })
  @IsOptional()
  @IsUUID()
  memberId?: string | null;
}
