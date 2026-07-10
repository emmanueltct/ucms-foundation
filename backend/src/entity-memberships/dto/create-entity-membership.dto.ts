import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEntityMembershipDto {
  @ApiProperty({ example: 'dynamicmodule:uuid-of-a-module-definition', description: 'The entity type the member is joining — conventionally "dynamicmodule:{moduleDefinitionId}".' })
  @IsString()
  attachedToEntityType: string;

  @ApiProperty({ description: 'The specific entity/record the member is joining' })
  @IsString()
  attachedToEntityId: string;

  @ApiProperty({ description: 'The already-registered Member being added — never a new Member is created here' })
  @IsUUID()
  memberId: string;

  @ApiPropertyOptional({ default: 'member' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  joinedAt?: string;
}
