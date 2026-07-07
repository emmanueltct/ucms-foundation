import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateAttendanceRecordDto {
  @ApiProperty({ description: 'Branch where attendance was taken' })
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional({ description: 'Member who attended — omit for an anonymous/bulk head-count entry' })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiProperty({
    example: 'sunday_service',
    description: 'Free-form key matching a ConfigItem in namespace "service_type"',
  })
  @IsString()
  serviceType: string;

  @ApiPropertyOptional({
    example: 'manual',
    description: 'Free-form key matching a ConfigItem in namespace "attendance_method"',
  })
  @IsOptional()
  @IsString()
  attendanceMethod?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Required (and must be > 0) for anonymous entries; ignored and forced to 1 when memberId is set',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  headcount?: number;

  @ApiProperty({ example: '2026-07-05' })
  @IsDateString()
  attendedAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
