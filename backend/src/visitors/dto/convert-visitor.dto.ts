import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ConvertVisitorDto {
  @ApiProperty({ description: 'An existing Member this visitor has become — create the Member first via the Members module' })
  @IsUUID()
  memberId: string;
}
