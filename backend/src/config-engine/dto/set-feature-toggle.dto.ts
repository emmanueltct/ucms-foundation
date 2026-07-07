import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, Matches } from 'class-validator';

export class SetFeatureToggleDto {
  @ApiProperty({ example: 'finance.momo_integration' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_.]*$/, { message: 'featureKey must be lowercase, e.g. "finance.momo_integration"' })
  featureKey: string;

  @ApiProperty()
  @IsBoolean()
  isEnabled: boolean;
}
