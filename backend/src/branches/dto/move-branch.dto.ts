import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class MoveBranchDto {
  @ApiPropertyOptional({ description: 'New parent branch id — omit/null to move this branch to the root of the hierarchy' })
  @IsOptional()
  @IsUUID()
  parentBranchId?: string | null;
}
