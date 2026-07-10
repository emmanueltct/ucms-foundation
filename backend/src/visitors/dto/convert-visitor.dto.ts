import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { RequireReasonDto } from '../../common/dto/require-reason.dto';

export class ConvertVisitorDto extends RequireReasonDto {
  @ApiProperty({ description: 'An existing Member this visitor has become — create the Member first via the Members module' })
  @IsUUID()
  memberId: string;
}
