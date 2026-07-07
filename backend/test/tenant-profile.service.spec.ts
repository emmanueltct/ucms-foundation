import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TenantProfileService } from '../src/tenants/tenant-profile.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { BranchesService } from '../src/branches/branches.service';

describe('TenantProfileService', () => {
  let service: TenantProfileService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = { tenant: { findFirst: jest.fn(), update: jest.fn() } };
  const mockBranches = { findAll: jest.fn(), create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TenantProfileService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BranchesService, useValue: mockBranches },
      ],
    }).compile();
    service = moduleRef.get(TenantProfileService);
  });

  describe('getProfile', () => {
    it('throws when the tenant cannot be found', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);
      await expect(service.getProfile(TENANT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('completeOnboarding', () => {
    it('creates a headquarters branch when none exists yet, then marks the tenant onboarded', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue({ id: TENANT_ID, name: 'Demo Church', onboardedAt: null });
      mockBranches.findAll.mockResolvedValue([]);
      mockPrisma.tenant.update.mockResolvedValue({ id: TENANT_ID, onboardedAt: new Date() });

      await service.completeOnboarding(TENANT_ID, {});

      expect(mockBranches.create).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({ name: 'Demo Church', isHeadquarters: true }),
      );
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT_ID },
        data: { onboardedAt: expect.any(Date) },
      });
    });

    it('does not create a branch when at least one already exists', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue({ id: TENANT_ID, name: 'Demo Church', onboardedAt: null });
      mockBranches.findAll.mockResolvedValue([{ id: 'existing-branch' }]);
      mockPrisma.tenant.update.mockResolvedValue({ id: TENANT_ID, onboardedAt: new Date() });

      await service.completeOnboarding(TENANT_ID, {});

      expect(mockBranches.create).not.toHaveBeenCalled();
      expect(mockPrisma.tenant.update).toHaveBeenCalled();
    });

    it('is idempotent — does not re-update an already-onboarded tenant', async () => {
      const onboardedTenant = { id: TENANT_ID, name: 'Demo Church', onboardedAt: new Date('2026-01-01') };
      mockPrisma.tenant.findFirst.mockResolvedValue(onboardedTenant);
      mockBranches.findAll.mockResolvedValue([{ id: 'existing-branch' }]);

      const result = await service.completeOnboarding(TENANT_ID, {});

      expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
      expect(result).toBe(onboardedTenant);
    });
  });
});
