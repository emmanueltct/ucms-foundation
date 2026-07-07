import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateMemberDto } from './create-member.dto';

/** Branch changes go through the dedicated `transfer` endpoint (FR-MM-2). */
export class UpdateMemberDto extends PartialType(OmitType(CreateMemberDto, ['branchId'] as const)) {}
