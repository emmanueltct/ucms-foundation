import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateBranchDto } from './create-branch.dto';

/** Parent changes go through the dedicated `move` endpoint, which runs cycle-prevention checks. */
export class UpdateBranchDto extends PartialType(OmitType(CreateBranchDto, ['parentBranchId'] as const)) {}
