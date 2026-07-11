import { ApiProperty } from '@nestjs/swagger';

export class PlatformAdminDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;
}

export class PlatformAuthResponseDto {
  @ApiProperty({ type: PlatformAdminDto })
  admin: PlatformAdminDto;

  @ApiProperty()
  accessToken: string;

  @ApiProperty({ description: 'Seconds until the access token expires' })
  expiresIn: number;
}
