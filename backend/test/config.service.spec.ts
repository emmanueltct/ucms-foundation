import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '../src/config-engine/config.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ConfigService', () => {
  let service: ConfigService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    configItem: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
    featureToggle: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ConfigService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(ConfigService);
  });

  it('rejects creating a duplicate key within the same tenant + namespace', async () => {
    mockPrisma.configItem.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create(TENANT_ID, { namespace: 'contribution_type', key: 'tithe', label: 'Tithe', value: {} }),
    ).rejects.toThrow(ConflictException);
  });

  it('allows the same key in different namespaces for the same tenant', async () => {
    mockPrisma.configItem.findUnique.mockResolvedValue(null);
    mockPrisma.configItem.create.mockResolvedValue({ id: 'new-item' });

    await service.create(TENANT_ID, { namespace: 'ministry', key: 'youth', label: 'Youth Ministry', value: {} });

    expect(mockPrisma.configItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ namespace: 'ministry', key: 'youth' }) }),
    );
  });

  it('excludes inactive items by default when listing a namespace', async () => {
    mockPrisma.configItem.findMany.mockResolvedValue([]);

    await service.findByNamespace(TENANT_ID, 'ceremony');

    expect(mockPrisma.configItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );
  });

  it('includes inactive items when explicitly requested', async () => {
    mockPrisma.configItem.findMany.mockResolvedValue([]);

    await service.findByNamespace(TENANT_ID, 'ceremony', true);

    const callArgs = mockPrisma.configItem.findMany.mock.calls[0][0];
    expect(callArgs.where.isActive).toBeUndefined();
  });

  it('deactivate() soft-toggles rather than deleting the row', async () => {
    mockPrisma.configItem.findFirst.mockResolvedValue({ id: 'item-1' });
    mockPrisma.configItem.update.mockResolvedValue({ id: 'item-1', isActive: false });

    const result = await service.deactivate(TENANT_ID, 'item-1');

    expect(mockPrisma.configItem.update).toHaveBeenCalledWith({ where: { id: 'item-1' }, data: { isActive: false } });
    expect(result.isActive).toBe(false);
  });

  it('setFeatureToggle upserts the flag for the tenant', async () => {
    mockPrisma.featureToggle.upsert.mockResolvedValue({ featureKey: 'finance.momo_integration', isEnabled: true });

    await service.setFeatureToggle(TENANT_ID, 'finance.momo_integration', true);

    expect(mockPrisma.featureToggle.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_featureKey: { tenantId: TENANT_ID, featureKey: 'finance.momo_integration' } },
      }),
    );
  });
});
