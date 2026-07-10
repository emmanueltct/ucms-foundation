import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsString, MinLength, ValidateIf } from 'class-validator';
import { CreateMemberDto } from './create-member.dto';

/** Branch changes go through the dedicated `transfer` endpoint (FR-MM-2). */
export class UpdateMemberDto extends PartialType(OmitType(CreateMemberDto, ['branchId'] as const)) {
  @ApiPropertyOptional({ description: 'Required whenever membershipStatus is included in this update — why the status is changing.' })
  @ValidateIf((o) => o.membershipStatus !== undefined)
  @IsString()
  @MinLength(3)
  reason?: string;
}
