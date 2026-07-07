import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BranchesService } from '../src/branches/branches.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('BranchesService', () => {
  let service: BranchesService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    branch: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [BranchesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(BranchesService);
  });

  describe('create', () => {
    it('rejects when parentBranchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, { name: 'Kigali Cell', parentBranchId: 'missing' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('clears the existing headquarters flag before creating a new headquarters branch', async () => {
      mockPrisma.branch.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.branch.create.mockResolvedValue({ id: 'new-hq', isHeadquarters: true });

      await service.create(TENANT_ID, { name: 'New HQ', isHeadquarters: true });

      expect(mockPrisma.branch.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, isHeadquarters: true }, data: { isHeadquarters: false } }),
      );
      expect(mockPrisma.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isHeadquarters: true }) }),
      );
    });
  });

  describe('findTree', () => {
    it('assembles a flat list into a nested tree', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([
        { id: 'a', parentBranchId: null, name: 'A' },
        { id: 'b', parentBranchId: 'a', name: 'B' },
        { id: 'c', parentBranchId: 'b', name: 'C' },
        { id: 'd', parentBranchId: null, name: 'D' },
      ]);

      const tree = await service.findTree(TENANT_ID);

      expect(tree).toHaveLength(2); // two roots: A and D
      const root = tree.find((n) => n.id === 'a')!;
      expect(root.children).toHaveLength(1);
      expect(root.children[0].id).toBe('b');
      expect(root.children[0].children[0].id).toBe('c');
    });
  });

  describe('ancestors / descendants', () => {
    const branchesById: Record<string, any> = {
      a: { id: 'a', tenantId: TENANT_ID, parentBranchId: null, name: 'A' },
      b: { id: 'b', tenantId: TENANT_ID, parentBranchId: 'a', name: 'B' },
      c: { id: 'c', tenantId: TENANT_ID, parentBranchId: 'b', name: 'C' },
    };

    beforeEach(() => {
      mockPrisma.branch.findFirst.mockImplementation(async ({ where }: any) => branchesById[where.id] ?? null);
      mockPrisma.branch.findMany.mockResolvedValue(Object.values(branchesById));
    });

    it('findAncestors returns the chain from immediate parent up to the root', async () => {
      const ancestors = await service.findAncestors(TENANT_ID, 'c');
      expect(ancestors.map((a) => a.id)).toEqual(['b', 'a']);
    });

    it('findDescendants flattens every level below the given branch', async () => {
      const descendants = await service.findDescendants(TENANT_ID, 'a');
      expect(descendants.map((d) => d.id).sort()).toEqual(['b', 'c']);
    });
  });

  describe('move', () => {
    const branchesById: Record<string, any> = {
      a: { id: 'a', tenantId: TENANT_ID, parentBranchId: null, name: 'A' },
      b: { id: 'b', tenantId: TENANT_ID, parentBranchId: 'a', name: 'B' },
      c: { id: 'c', tenantId: TENANT_ID, parentBranchId: 'b', name: 'C' },
      d: { id: 'd', tenantId: TENANT_ID, parentBranchId: null, name: 'D' },
    };

    beforeEach(() => {
      mockPrisma.branch.findFirst.mockImplementation(async ({ where }: any) => branchesById[where.id] ?? null);
    });

    it('rejects moving a branch under itself', async () => {
      await expect(service.move(TENANT_ID, 'a', 'a')).rejects.toThrow(BadRequestException);
    });

    it('rejects moving a branch under one of its own descendants', async () => {
      // Moving 'a' under 'c' would make 'a' its own great-grandchild's child.
      await expect(service.move(TENANT_ID, 'a', 'c')).rejects.toThrow(BadRequestException);
    });

    it('allows a valid move to an unrelated branch', async () => {
      mockPrisma.branch.update.mockResolvedValue({ id: 'c', parentBranchId: 'd' });

      await service.move(TENANT_ID, 'c', 'd');

      expect(mockPrisma.branch.update).toHaveBeenCalledWith({ where: { id: 'c' }, data: { parentBranchId: 'd' } });
    });

    it('allows moving a branch to the root by passing a null parent', async () => {
      mockPrisma.branch.update.mockResolvedValue({ id: 'c', parentBranchId: null });

      await service.move(TENANT_ID, 'c', null);

      expect(mockPrisma.branch.update).toHaveBeenCalledWith({ where: { id: 'c' }, data: { parentBranchId: null } });
    });
  });

  describe('deactivate / reactivate', () => {
    const branchesById: Record<string, any> = {
      a: { id: 'a', tenantId: TENANT_ID, parentBranchId: null, name: 'A', isActive: true },
      b: { id: 'b', tenantId: TENANT_ID, parentBranchId: 'a', name: 'B', isActive: true },
      c: { id: 'c', tenantId: TENANT_ID, parentBranchId: 'b', name: 'C', isActive: true },
    };

    beforeEach(() => {
      mockPrisma.branch.findFirst.mockImplementation(async ({ where }: any) => branchesById[where.id] ?? null);
      mockPrisma.branch.findMany.mockResolvedValue(Object.values(branchesById));
      mockPrisma.branch.updateMany.mockResolvedValue({ count: 3 });
    });

    it('deactivate cascades to every descendant', async () => {
      await service.deactivate(TENANT_ID, 'a');

      expect(mockPrisma.branch.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['a', 'b', 'c'] }, tenantId: TENANT_ID },
        data: { isActive: false },
      });
    });

    it('reactivate only touches the single branch, not its descendants', async () => {
      mockPrisma.branch.update.mockResolvedValue({ id: 'a', isActive: true });

      await service.reactivate(TENANT_ID, 'a');

      expect(mockPrisma.branch.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { isActive: true } });
      expect(mockPrisma.branch.updateMany).not.toHaveBeenCalled();
    });
  });
});
