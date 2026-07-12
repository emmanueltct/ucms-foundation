import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSecuritySettingsDto } from './dto/update-security-settings.dto';

/** Platform defaults — exactly what `AuthService` hardcoded before this module existed; every field a tenant leaves unconfigured falls back to these. */
export const DEFAULT_ACCESS_TOKEN_TTL_MINUTES = 15;
export const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 7;

export interface EffectiveSecuritySettings {
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
  inactivityLogoutMinutes: number | null;
  maxConcurrentSessions: number | null;
}

/**
 * Resolves a tenant's session/token security configuration — a thin
 * read/upsert wrapper over `TenantSecuritySettings`, deliberately with no
 * per-tenant caching: `getEffective` is called on every login/refresh, and a
 * Denomination Admin changing these values should take effect on the very
 * next request, not after some cache TTL expires.
 */
@Injectable()
export class SecuritySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffective(tenantId: string): Promise<EffectiveSecuritySettings> {
    const row = await this.prisma.tenantSecuritySettings.findUnique({ where: { tenantId } });
    return {
      accessTokenTtlMinutes: row?.accessTokenTtlMinutes ?? DEFAULT_ACCESS_TOKEN_TTL_MINUTES,
      refreshTokenTtlDays: row?.refreshTokenTtlDays ?? DEFAULT_REFRESH_TOKEN_TTL_DAYS,
      inactivityLogoutMinutes: row?.inactivityLogoutMinutes ?? null,
      maxConcurrentSessions: row?.maxConcurrentSessions ?? null,
    };
  }

  /** Raw configured row (nulls mean "not overridden", distinct from the resolved defaults `getEffective` returns) — what the admin UI edits. */
  async getConfigured(tenantId: string) {
    return this.prisma.tenantSecuritySettings.findUnique({ where: { tenantId } });
  }

  async update(tenantId: string, dto: UpdateSecuritySettingsDto) {
    return this.prisma.tenantSecuritySettings.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: { ...dto },
    });
  }
}
