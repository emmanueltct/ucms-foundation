import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class EntityMembershipQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter to memberships of this entity type' })
  @IsOptional()
  @IsString()
  attachedToEntityType?: string;

  @ApiPropertyOptional({ description: 'Filter to memberships of this specific entity — usually combined with attachedToEntityType' })
  @IsOptional()
  @IsString()
  attachedToEntityId?: string;

  @ApiPropertyOptional({ description: "Filter to one member's memberships" })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;
}
