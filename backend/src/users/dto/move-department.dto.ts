import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class MoveDepartmentDto {
  @ApiPropertyOptional({ description: 'The department (Dynamic Module Record) to move this user into — omit/null to clear their department assignment' })
  @IsOptional()
  @IsUUID()
  departmentRecordId?: string | null;
}
