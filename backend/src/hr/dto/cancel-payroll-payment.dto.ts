import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CancelPayrollPaymentDto {
  @ApiProperty({ example: 'Duplicate entry — same period paid twice' })
  @IsString()
  @MinLength(3)
  cancelReason: string;
}
