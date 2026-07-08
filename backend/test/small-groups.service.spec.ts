import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SmallGroupsService } from '../src/small-groups/small-groups.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('SmallGroupsService', () => {
  let service: SmallGroupsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    smallGroup: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
    smallGroupMembership: { updateMany: jest.fn() },
    branch: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [SmallGroupsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(SmallGroupsService);
  });

  describe('create', () => {
    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      await expect(
        service.create(TENANT_ID, { name: 'Kimironko Home Group', branchId: 'missing' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate small group name within the tenant', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.create(TENANT_ID, { name: 'Kimironko Home Group' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects an age range where minAge exceeds maxAge', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValue(null);
      await expect(
        service.create(TENANT_ID, { name: 'Sunday School', minAge: 10, maxAge: 6 } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.smallGroup.create).not.toHaveBeenCalled();
    });

    it('creates a church-wide group when branchId is omitted', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValue(null);
      mockPrisma.smallGroup.create.mockResolvedValue({ id: 'sg-1', branchId: null });

      await service.create(TENANT_ID, { name: 'Missions Group' } as any);

      expect(mockPrisma.branch.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.smallGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ branchId: null }) }),
      );
    });
  });

  describe('update', () => {
    const existing = { id: 'sg-1', tenantId: TENANT_ID, name: 'Home Group', branchId: null, minAge: null, maxAge: null };

    it('allows renaming when the new name is not already taken', async () => {
      mockPrisma.smallGroup.findFirst
        .mockResolvedValueOnce(existing) // findOne
        .mockResolvedValueOnce(null); // name-free check
      mockPrisma.smallGroup.update.mockResolvedValue({ ...existing, name: 'Kimironko Group' });

      await service.update(TENANT_ID, 'sg-1', { name: 'Kimironko Group' } as any);

      expect(mockPrisma.smallGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Kimironko Group' }) }),
      );
    });

    it('rejects renaming to a name already used by another group', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValueOnce(existing).mockResolvedValueOnce({ id: 'other-group' });

      await expect(service.update(TENANT_ID, 'sg-1', { name: 'Youth Group' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('re-validates the age range using existing values merged with the update', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValueOnce({ ...existing, minAge: 6, maxAge: 9 });

      await expect(service.update(TENANT_ID, 'sg-1', { maxAge: 4 } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('softDelete', () => {
    it('deactivates the group and every one of its memberships', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValue({ id: 'sg-1' });
      mockPrisma.smallGroupMembership.updateMany.mockResolvedValue({ count: 5 });
      mockPrisma.smallGroup.update.mockResolvedValue({ id: 'sg-1', isActive: false });

      await service.softDelete(TENANT_ID, 'sg-1');

      expect(mockPrisma.smallGroupMembership.updateMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, smallGroupId: 'sg-1' },
        data: { isActive: false },
      });
      expect(mockPrisma.smallGroup.update).toHaveBeenCalledWith({
        where: { id: 'sg-1' },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
    });
  });
});
