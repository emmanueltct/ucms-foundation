import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ description: 'Seconds until the access token expires' })
  expiresIn: number;
}

export class AuthUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ type: [String] })
  roles: string[];

  @ApiProperty({ type: [String] })
  permissions: string[];

  @ApiProperty()
  mfaEnabled: boolean;
}

export class AuthTenantDto {
  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: AuthTokensDto })
  tokens: AuthTokensDto;

  @ApiProperty({ type: AuthTenantDto, description: 'Which church workspace this session is scoped to' })
  tenant: AuthTenantDto;
}

export class WorkspaceOptionDto {
  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;
}

/** Returned instead of AuthResponseDto when the same email+password matches more than one church workspace. */
export class WorkspaceSelectionResponseDto {
  @ApiProperty({ default: true })
  requiresWorkspaceSelection: true;

  @ApiProperty({ type: [WorkspaceOptionDto] })
  workspaces: WorkspaceOptionDto[];
}
