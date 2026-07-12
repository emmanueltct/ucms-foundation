import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional({ description: 'Login access-token lifetime, in minutes. Omit/null to use the platform default (15).' })
  @IsOptional()
  @IsInt()
  @Min(1)
  accessTokenTtlMinutes?: number | null;

  @ApiPropertyOptional({ description: 'Refresh-token (how long a session survives without re-entering credentials) lifetime, in days. Omit/null to use the platform default (7).' })
  @IsOptional()
  @IsInt()
  @Min(1)
  refreshTokenTtlDays?: number | null;

  @ApiPropertyOptional({ description: 'Automatically sign a session out after this many minutes of inactivity (no token refresh). Omit/null to disable.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  inactivityLogoutMinutes?: number | null;

  @ApiPropertyOptional({ description: 'Maximum concurrent device sessions per user — the oldest is signed out to make room for a new login beyond this limit. Omit/null for unlimited.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxConcurrentSessions?: number | null;
}
