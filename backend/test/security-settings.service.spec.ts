import { Test } from '@nestjs/testing';
import { SecuritySettingsService, DEFAULT_ACCESS_TOKEN_TTL_MINUTES, DEFAULT_REFRESH_TOKEN_TTL_DAYS } from '../src/security-settings/security-settings.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('SecuritySettingsService', () => {
  let service: SecuritySettingsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    tenantSecuritySettings: { findUnique: jest.fn(), upsert: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [SecuritySettingsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(SecuritySettingsService);
  });

  describe('getEffective', () => {
    it('falls back to the platform defaults when the tenant has no configured row', async () => {
      mockPrisma.tenantSecuritySettings.findUnique.mockResolvedValue(null);

      const result = await service.getEffective(TENANT_ID);

      expect(result).toEqual({
        accessTokenTtlMinutes: DEFAULT_ACCESS_TOKEN_TTL_MINUTES,
        refreshTokenTtlDays: DEFAULT_REFRESH_TOKEN_TTL_DAYS,
        inactivityLogoutMinutes: null,
        maxConcurrentSessions: null,
      });
    });

    it('uses each configured field, falling back individually for any left null', async () => {
      mockPrisma.tenantSecuritySettings.findUnique.mockResolvedValue({
        accessTokenTtlMinutes: 30,
        refreshTokenTtlDays: null,
        inactivityLogoutMinutes: 20,
        maxConcurrentSessions: 3,
      });

      const result = await service.getEffective(TENANT_ID);

      expect(result).toEqual({
        accessTokenTtlMinutes: 30,
        refreshTokenTtlDays: DEFAULT_REFRESH_TOKEN_TTL_DAYS,
        inactivityLogoutMinutes: 20,
        maxConcurrentSessions: 3,
      });
    });
  });

  describe('update', () => {
    it('upserts by tenantId', async () => {
      mockPrisma.tenantSecuritySettings.upsert.mockResolvedValue({ tenantId: TENANT_ID, accessTokenTtlMinutes: 45 });

      await service.update(TENANT_ID, { accessTokenTtlMinutes: 45 });

      expect(mockPrisma.tenantSecuritySettings.upsert).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
        create: { tenantId: TENANT_ID, accessTokenTtlMinutes: 45 },
        update: { accessTokenTtlMinutes: 45 },
      });
    });
  });
});
