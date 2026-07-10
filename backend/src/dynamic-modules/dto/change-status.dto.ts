import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { RequireReasonDto } from '../../common/dto/require-reason.dto';

export class ChangeDynamicModuleRecordStatusDto extends RequireReasonDto {
  @ApiProperty({ description: 'Must be one of the module definition\'s configured statuses.' })
  @IsString()
  toStatus: string;
}
