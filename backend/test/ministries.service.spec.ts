import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MinistriesService } from '../src/ministries/ministries.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('MinistriesService', () => {
  let service: MinistriesService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    ministry: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
    ministryMembership: { updateMany: jest.fn() },
    branch: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [MinistriesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(MinistriesService);
  });

  describe('create', () => {
    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      await expect(
        service.create(TENANT_ID, { name: 'Youth Ministry', branchId: 'missing' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate ministry name within the tenant', async () => {
      mockPrisma.ministry.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.create(TENANT_ID, { name: 'Youth Ministry' } as any)).rejects.toThrow(ConflictException);
    });

    it('creates a church-wide ministry when branchId is omitted', async () => {
      mockPrisma.ministry.findFirst.mockResolvedValue(null);
      mockPrisma.ministry.create.mockResolvedValue({ id: 'min-1', branchId: null });

      await service.create(TENANT_ID, { name: 'Missions' } as any);

      expect(mockPrisma.branch.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.ministry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ branchId: null }) }),
      );
    });
  });

  describe('update', () => {
    const existing = { id: 'min-1', tenantId: TENANT_ID, name: 'Youth Ministry', branchId: null };

    it('allows renaming when the new name is not already taken', async () => {
      mockPrisma.ministry.findFirst
        .mockResolvedValueOnce(existing) // findOne
        .mockResolvedValueOnce(null); // name-free check
      mockPrisma.ministry.update.mockResolvedValue({ ...existing, name: 'Youth & Young Adults' });

      await service.update(TENANT_ID, 'min-1', { name: 'Youth & Young Adults' } as any);

      expect(mockPrisma.ministry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Youth & Young Adults' }) }),
      );
    });

    it('rejects renaming to a name already used by another ministry', async () => {
      mockPrisma.ministry.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ id: 'other-ministry' });

      await expect(service.update(TENANT_ID, 'min-1', { name: 'Choir' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('scopes to the visible branch set but still includes church-wide ministries when the caller is branch-restricted', async () => {
      mockPrisma.ministry.findMany.mockResolvedValue([]);
      mockPrisma.ministry.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {} as any, ['branch-1', 'branch-2']);

      expect(mockPrisma.ministry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [{ OR: [{ branchId: { in: ['branch-1', 'branch-2'] } }, { branchId: null }] }],
          }),
        }),
      );
    });

    it('is unrestricted when visibleBranchIds is null (the default)', async () => {
      mockPrisma.ministry.findMany.mockResolvedValue([]);
      mockPrisma.ministry.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {} as any);

      expect(mockPrisma.ministry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.not.objectContaining({ AND: expect.anything() }) }),
      );
    });
  });

  describe('softDelete', () => {
    it('deactivates the ministry and every one of its memberships', async () => {
      mockPrisma.ministry.findFirst.mockResolvedValue({ id: 'min-1' });
      mockPrisma.ministryMembership.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.ministry.update.mockResolvedValue({ id: 'min-1', isActive: false });

      await service.softDelete(TENANT_ID, 'min-1');

      expect(mockPrisma.ministryMembership.updateMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, ministryId: 'min-1' },
        data: { isActive: false },
      });
      expect(mockPrisma.ministry.update).toHaveBeenCalledWith({
        where: { id: 'min-1' },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
    });
  });
});
