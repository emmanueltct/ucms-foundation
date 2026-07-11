import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'member@demo-church.test' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'ChangeMe123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'Password must contain at least one letter and one number.' })
  password: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ type: [String], description: 'Role IDs to assign on creation' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Which branch this user is assigned to for organizational-visibility roll-up (see BranchScopeService). Omit/null for unrestricted (church-wide) access — the default.',
  })
  @IsOptional()
  @IsString()
  assignedBranchId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Which department (Dynamic Module Record) this user is assigned to — see DepartmentScopeService. Omit/null for unrestricted.',
  })
  @IsOptional()
  @IsString()
  assignedDepartmentRecordId?: string | null;

  @ApiPropertyOptional({ enum: ['leader', 'staff'], nullable: true, description: 'Only meaningful when assignedDepartmentRecordId is set.' })
  @IsOptional()
  @IsIn(['leader', 'staff'])
  departmentRole?: 'leader' | 'staff' | null;
}
