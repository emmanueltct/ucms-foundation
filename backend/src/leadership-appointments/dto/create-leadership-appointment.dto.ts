import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateLeadershipAppointmentDto {
  @ApiProperty({ example: 'branch', description: '"branch" | "dynamic_module_record" | any other leadable entity type' })
  @IsString()
  targetEntityType: string;

  @ApiProperty({ description: 'The target entity\'s row id (a Branch.id, a DynamicModuleRecord.id, ...)' })
  @IsString()
  targetEntityId: string;

  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ default: 'leader' })
  @IsOptional()
  @IsString()
  role?: string;
}
