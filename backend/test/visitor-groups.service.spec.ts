import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VisitorGroupsService } from '../src/visitors/visitor-groups.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('VisitorGroupsService', () => {
  let service: VisitorGroupsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    visitorGroup: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
    visitor: { findMany: jest.fn() },
    branch: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [VisitorGroupsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(VisitorGroupsService);
  });

  describe('create', () => {
    const baseDto = { name: 'Kigali Youth Choir', groupType: 'choir_visit', visitDate: '2026-07-12' };

    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.create(TENANT_ID, { ...baseDto, branchId: 'branch-1' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates the group when references are valid', async () => {
      mockPrisma.visitorGroup.create.mockResolvedValue({ id: 'group-1' });

      await service.create(TENANT_ID, baseDto as any);

      expect(mockPrisma.visitorGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT_ID, groupType: 'choir_visit' }) }),
      );
    });
  });

  describe('softDelete', () => {
    it('rejects when the group does not exist', async () => {
      mockPrisma.visitorGroup.findFirst.mockResolvedValue(null);

      await expect(service.softDelete(TENANT_ID, 'group-1')).rejects.toThrow(NotFoundException);
    });

    it('deactivates the group', async () => {
      mockPrisma.visitorGroup.findFirst.mockResolvedValue({ id: 'group-1' });
      mockPrisma.visitorGroup.update.mockResolvedValue({ id: 'group-1', isActive: false });

      await service.softDelete(TENANT_ID, 'group-1');

      expect(mockPrisma.visitorGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'group-1' }, data: expect.objectContaining({ isActive: false }) }),
      );
    });
  });

  describe('listMembers', () => {
    it('rejects when the group does not exist', async () => {
      mockPrisma.visitorGroup.findFirst.mockResolvedValue(null);

      await expect(service.listMembers(TENANT_ID, 'group-1')).rejects.toThrow(NotFoundException);
    });

    it('returns the visitors belonging to this group', async () => {
      mockPrisma.visitorGroup.findFirst.mockResolvedValue({ id: 'group-1' });
      mockPrisma.visitor.findMany.mockResolvedValue([{ id: 'visitor-1' }, { id: 'visitor-2' }]);

      const result = await service.listMembers(TENANT_ID, 'group-1');

      expect(mockPrisma.visitor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, visitorGroupId: 'group-1', deletedAt: null } }),
      );
      expect(result).toHaveLength(2);
    });
  });
});
