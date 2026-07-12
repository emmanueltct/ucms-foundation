import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BranchesService } from '../src/branches/branches.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { HierarchyLevelsService } from '../src/hierarchy-levels/hierarchy-levels.service';
import { LeadershipScopeService } from '../src/common/leadership-scope/leadership-scope.service';
import { FormAssignmentNotifier } from '../src/common/form-assignment-notifier/form-assignment-notifier.service';
import { AuthenticatedUser } from '../src/common/interfaces/request-context.interface';

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
    user: {
      findFirst: jest.fn(),
    },
    resourceAssignment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  // No existing test defines any HierarchyLevelDefinition rows, so every type is unconstrained (`findForType` -> null) — matches pre-Phase-3 behavior exactly.
  const mockHierarchyLevels = { findForType: jest.fn().mockResolvedValue(null) };

  const mockLeadershipScope = { isLeaderOf: jest.fn() };
  const mockFormAssignmentNotifier = { notifyIfForm: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockHierarchyLevels.findForType.mockResolvedValue(null);
    mockLeadershipScope.isLeaderOf.mockResolvedValue(false);
    const moduleRef = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: HierarchyLevelsService, useValue: mockHierarchyLevels },
        { provide: LeadershipScopeService, useValue: mockLeadershipScope },
        { provide: FormAssignmentNotifier, useValue: mockFormAssignmentNotifier },
      ],
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

  describe('hierarchy level rules', () => {
    const parentBranch = { id: 'parent-1', tenantId: TENANT_ID, name: 'HQ', branchType: 'district' };

    beforeEach(() => {
      mockPrisma.branch.findFirst.mockImplementation(async ({ where }: any) =>
        where.id === parentBranch.id ? parentBranch : null,
      );
    });

    it('rejects a child whose allowedParentTypeKeys does not include the parent\'s branchType', async () => {
      mockHierarchyLevels.findForType.mockImplementation(async (_tenantId: string, key: string) =>
        key === 'parish' ? { label: 'Parish', allowedParentTypeKeys: ['diocese'], allowedChildTypeKeys: [] } : null,
      );

      await expect(
        service.create(TENANT_ID, { name: 'St. Mark', branchType: 'parish', parentBranchId: parentBranch.id }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a parent whose allowedChildTypeKeys does not include the child's branchType", async () => {
      mockHierarchyLevels.findForType.mockImplementation(async (_tenantId: string, key: string) =>
        key === 'district' ? { label: 'District', allowedParentTypeKeys: [], allowedChildTypeKeys: ['cell'] } : null,
      );

      await expect(
        service.create(TENANT_ID, { name: 'St. Mark', branchType: 'parish', parentBranchId: parentBranch.id }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows creation when the rule permits the pairing', async () => {
      mockHierarchyLevels.findForType.mockImplementation(async (_tenantId: string, key: string) =>
        key === 'parish' ? { label: 'Parish', allowedParentTypeKeys: ['district'], allowedChildTypeKeys: [] } : null,
      );
      mockPrisma.branch.create.mockResolvedValue({ id: 'new-parish', branchType: 'parish' });

      await expect(
        service.create(TENANT_ID, { name: 'St. Mark', branchType: 'parish', parentBranchId: parentBranch.id }),
      ).resolves.toBeDefined();
    });

    it('skips validation entirely when neither side has a branchType', async () => {
      mockPrisma.branch.create.mockResolvedValue({ id: 'new-branch' });

      await expect(
        service.create(TENANT_ID, { name: 'Untyped Branch', parentBranchId: parentBranch.id }),
      ).resolves.toBeDefined();
      expect(mockHierarchyLevels.findForType).not.toHaveBeenCalled();
    });
  });

  describe('branch-scoped delegation', () => {
    const districtBranch = { id: 'district-1', tenantId: TENANT_ID, name: 'District', branchType: null };
    const parishBranch = { id: 'parish-1', tenantId: TENANT_ID, name: 'Parish', branchType: null, parentBranchId: 'district-1' };
    const unrelatedBranch = { id: 'other-1', tenantId: TENANT_ID, name: 'Unrelated', branchType: null };

    beforeEach(() => {
      mockPrisma.branch.findFirst.mockImplementation(async ({ where }: any) => {
        if (where.id === districtBranch.id) return districtBranch;
        if (where.id === parishBranch.id) return parishBranch;
        if (where.id === unrelatedBranch.id) return unrelatedBranch;
        return null;
      });
      mockPrisma.branch.findMany.mockResolvedValue([districtBranch, parishBranch, unrelatedBranch]);
      mockPrisma.branch.create.mockResolvedValue({ id: 'new-branch' });
    });

    it('skips the check entirely when no callerUserId is passed (system-initiated create)', async () => {
      await expect(
        service.create(TENANT_ID, { name: 'HQ' }),
      ).resolves.toBeDefined();
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('is unrestricted for a caller with no assignedBranchId (church-wide staff)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: null });

      await expect(
        service.create(TENANT_ID, { name: 'New Branch', parentBranchId: unrelatedBranch.id }, 'caller-1'),
      ).resolves.toBeDefined();
    });

    it('rejects a branch-scoped caller creating a root-level branch', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: districtBranch.id });

      await expect(
        service.create(TENANT_ID, { name: 'New Root Branch' }, 'caller-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects a branch-scoped caller creating a sub-branch outside their own visible scope", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: districtBranch.id });

      await expect(
        service.create(TENANT_ID, { name: 'Sneaky Branch', parentBranchId: unrelatedBranch.id }, 'caller-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a branch-scoped caller to create a sub-branch under their own assigned branch', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: districtBranch.id });

      await expect(
        service.create(TENANT_ID, { name: 'Sub Branch', parentBranchId: districtBranch.id }, 'caller-1'),
      ).resolves.toBeDefined();
    });

    it('allows a branch-scoped caller to create a sub-branch under a descendant of their assigned branch', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: districtBranch.id });

      await expect(
        service.create(TENANT_ID, { name: 'Grandchild Branch', parentBranchId: parishBranch.id }, 'caller-1'),
      ).resolves.toBeDefined();
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

  describe('resource assignment', () => {
    const branch = { id: 'branch-1', tenantId: TENANT_ID, name: 'HQ' };
    const baseUser: AuthenticatedUser = {
      userId: 'user-1', tenantId: TENANT_ID, email: 'admin@example.com', isPlatformAdmin: false, permissions: [], roles: [],
    };

    beforeEach(() => {
      mockPrisma.branch.findFirst.mockResolvedValue(branch);
    });

    it('listResources confirms the branch exists then resolves its scope', async () => {
      mockPrisma.resourceAssignment.findMany.mockResolvedValue([{ id: 'ra-1' }]);

      const result = await service.listResources(TENANT_ID, 'branch-1');

      expect(mockPrisma.resourceAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, scopeEntityType: 'branch', scopeEntityId: 'branch-1' } }),
      );
      expect(result).toEqual([{ id: 'ra-1' }]);
    });

    it('assignResource rejects a caller without branch.update and not a platform admin', async () => {
      await expect(
        service.assignResource(TENANT_ID, 'branch-1', { resourceType: 'module', resourceKey: 'mod-1' }, baseUser),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.resourceAssignment.create).not.toHaveBeenCalled();
    });

    it('assignResource succeeds for a caller with branch.update', async () => {
      const authorizedUser = { ...baseUser, permissions: ['branch.update'] };
      mockPrisma.resourceAssignment.findUnique.mockResolvedValue(null);
      mockPrisma.resourceAssignment.create.mockResolvedValue({ id: 'ra-1' });

      const result = await service.assignResource(TENANT_ID, 'branch-1', { resourceType: 'module', resourceKey: 'mod-1' }, authorizedUser);

      expect(mockPrisma.resourceAssignment.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT_ID, scopeEntityType: 'branch', scopeEntityId: 'branch-1', resourceType: 'module', resourceKey: 'mod-1' },
      });
      expect(result).toEqual({ id: 'ra-1' });
    });

    it('assignResource rejects when the same resource is already assigned to this branch', async () => {
      const authorizedUser = { ...baseUser, permissions: ['branch.update'] };
      mockPrisma.resourceAssignment.findUnique.mockResolvedValue({ id: 'existing-ra' });

      await expect(
        service.assignResource(TENANT_ID, 'branch-1', { resourceType: 'module', resourceKey: 'mod-1' }, authorizedUser),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.resourceAssignment.create).not.toHaveBeenCalled();
    });

    it('assignResource is unrestricted for a platform admin', async () => {
      const platformAdmin = { ...baseUser, isPlatformAdmin: true };
      mockPrisma.resourceAssignment.findUnique.mockResolvedValue(null);
      mockPrisma.resourceAssignment.create.mockResolvedValue({ id: 'ra-1' });

      await expect(
        service.assignResource(TENANT_ID, 'branch-1', { resourceType: 'module', resourceKey: 'mod-1' }, platformAdmin),
      ).resolves.toBeDefined();
    });

    it('assignResource succeeds for a caller who holds a LeadershipAppointment over this branch (Branch Administrator), even without branch.update', async () => {
      mockLeadershipScope.isLeaderOf.mockResolvedValue(true);
      mockPrisma.resourceAssignment.findUnique.mockResolvedValue(null);
      mockPrisma.resourceAssignment.create.mockResolvedValue({ id: 'ra-1' });

      const result = await service.assignResource(TENANT_ID, 'branch-1', { resourceType: 'module', resourceKey: 'mod-1' }, baseUser);

      expect(mockLeadershipScope.isLeaderOf).toHaveBeenCalledWith(TENANT_ID, baseUser.userId, 'branch', 'branch-1');
      expect(result).toEqual({ id: 'ra-1' });
    });

    it('assignResource converts a given dueAt string to a Date and hands the created assignment to FormAssignmentNotifier', async () => {
      const authorizedUser = { ...baseUser, permissions: ['branch.update'] };
      mockPrisma.resourceAssignment.findUnique.mockResolvedValue(null);
      const created = { id: 'ra-1', dueAt: new Date('2026-08-01T00:00:00.000Z') };
      mockPrisma.resourceAssignment.create.mockResolvedValue(created);

      await service.assignResource(
        TENANT_ID,
        'branch-1',
        { resourceType: 'dynamic_module_definition', resourceKey: 'form-1', dueAt: '2026-08-01T00:00:00.000Z' },
        authorizedUser,
      );

      expect(mockPrisma.resourceAssignment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ dueAt: new Date('2026-08-01T00:00:00.000Z') }),
      });
      expect(mockFormAssignmentNotifier.notifyIfForm).toHaveBeenCalledWith(TENANT_ID, created);
    });

    it('removeResource rejects a caller without branch.update', async () => {
      await expect(service.removeResource(TENANT_ID, 'branch-1', 'ra-1', baseUser)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.resourceAssignment.delete).not.toHaveBeenCalled();
    });

    it('removeResource succeeds for a caller with branch.update', async () => {
      const authorizedUser = { ...baseUser, permissions: ['branch.update'] };
      mockPrisma.resourceAssignment.findFirst.mockResolvedValue({ id: 'ra-1' });
      mockPrisma.resourceAssignment.delete.mockResolvedValue({ id: 'ra-1' });

      const result = await service.removeResource(TENANT_ID, 'branch-1', 'ra-1', authorizedUser);

      expect(mockPrisma.resourceAssignment.delete).toHaveBeenCalledWith({ where: { id: 'ra-1' } });
      expect(result).toEqual({ id: 'ra-1' });
    });
  });
});
