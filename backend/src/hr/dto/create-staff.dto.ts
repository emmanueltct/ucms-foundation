import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'volunteer_stipend'] as const;
const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'terminated'] as const;

export class CreateStaffDto {
  @ApiProperty({ example: 'Jean' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Uwimana' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ description: 'Link to an existing Member, if this staff member is also a congregant' })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({ description: 'Branch they primarily work at — omit for a church-wide/admin role' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    example: 'senior_pastor',
    description: 'Free-form key matching a ConfigItem in namespace "staff_position"',
  })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({
    example: 'pastoral',
    description: 'Free-form key matching a ConfigItem in namespace "department"',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ enum: EMPLOYMENT_TYPES })
  @IsIn(EMPLOYMENT_TYPES)
  employmentType: string;

  @ApiPropertyOptional({ enum: EMPLOYMENT_STATUSES, default: 'active' })
  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES)
  employmentStatus?: string;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiPropertyOptional({ example: 250000, description: "Defaults to the tenant's current currency if provided without salaryCurrency" })
  @IsOptional()
  @IsPositive()
  @IsNumber()
  baseSalary?: number;

  @ApiPropertyOptional({ example: 'RWF' })
  @IsOptional()
  @IsString()
  salaryCurrency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
