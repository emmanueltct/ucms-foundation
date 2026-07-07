import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TransferMemberDto {
  @ApiProperty({ description: 'Branch to move this member to' })
  @IsUUID()
  branchId: string;
}
