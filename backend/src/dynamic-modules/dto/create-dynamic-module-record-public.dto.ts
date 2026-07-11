import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * A deliberately smaller field set than `CreateDynamicModuleRecordDto` —
 * mirrors `RegisterMemberDto`'s "public form, server controls the rest"
 * shape. No `attachedToEntityType`/`attachedToEntityId`/`parentRecordId`
 * (structural/admin concerns a guest submitter shouldn't set) and no
 * `createdByUserId` (there is no authenticated caller).
 */
export class CreateDynamicModuleRecordPublicDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Which branch this submission relates to, if the church has more than one location' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
