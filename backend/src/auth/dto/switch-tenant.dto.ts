import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SwitchTenantDto {
  @ApiProperty({ description: 'The workspace slug to switch into — you must have an active account there' })
  @IsString()
  tenantSlug: string;
}
