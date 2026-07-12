import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantsService } from '../src/tenants/tenants.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DynamicModuleDefinitionsService } from '../src/dynamic-modules/dynamic-module-definitions.service';

/** Returns the same mock { deleteMany, updateMany, delete } object for a given model name every time it's accessed, so assertions against `tx.user.updateMany` etc. see the calls made through the proxy. */
function createMockTx() {
  const cache: Record<string, { deleteMany: jest.Mock; updateMany: jest.Mock; delete: jest.Mock }> = {};
  return new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        if (!cache[prop]) {
          cache[prop] = {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            delete: jest.fn().mockResolvedValue({ id: 'tenant-1' }),
          };
        }
        return cache[prop];
      },
    },
  ) as unknown as Record<string, { deleteMany: jest.Mock; updateMany: jest.Mock; delete: jest.Mock }>;
}

describe('TenantsService', () => {
  let service: TenantsService;
  let mockTx: ReturnType<typeof createMockTx>;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    tenant: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    permission: { findMany: jest.fn() },
    role: { create: jest.fn() },
    user: { create: jest.fn() },
    configItem: { createMany: jest.fn() },
    hierarchyLevelDefinition: { createMany: jest.fn() },
    branch: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockDynamicModuleDefinitions = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTx = createMockTx();
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx));

    const moduleRef = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DynamicModuleDefinitionsService, useValue: mockDynamicModuleDefinitions },
      ],
    }).compile();
    service = moduleRef.get(TenantsService);
  });

  describe('hardDelete', () => {
    it('throws NotFoundException when the tenant does not exist', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.hardDelete(TENANT_ID)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the tenant is not already soft-deleted', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, deletedAt: null });

      await expect(service.hardDelete(TENANT_ID)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('breaks the User<->Branch/DynamicModuleRecord and Family<->Member cycles before deleting either side', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, deletedAt: new Date() });

      await service.hardDelete(TENANT_ID);

      expect(mockTx.user.updateMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
        data: { assignedBranchId: null, assignedDepartmentRecordId: null },
      });
      expect(mockTx.family.updateMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID }, data: { headOfFamilyId: null } });
    });

    it('deletes every tenant-owned row before deleting the Tenant row itself, then returns purged:true', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, deletedAt: new Date() });

      const result = await service.hardDelete(TENANT_ID);

      // Representative sample across the dependency order, not exhaustive:
      // a leaf (references Member/Branch/User), a mid-tier entity, and the two hub tables.
      expect(mockTx.contribution.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
      expect(mockTx.member.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
      expect(mockTx.user.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
      expect(mockTx.branch.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
      expect(mockTx.role.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
      expect(mockTx.tenant.delete).toHaveBeenCalledWith({ where: { id: TENANT_ID } });
      expect(result).toEqual({ purged: true });
    });

    it('deletes Staff and Visitor (which reference Member) before Member itself', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, deletedAt: new Date() });
      const order: string[] = [];
      mockTx.staff.deleteMany.mockImplementation(async () => { order.push('staff'); return { count: 0 }; });
      mockTx.visitor.deleteMany.mockImplementation(async () => { order.push('visitor'); return { count: 0 }; });
      mockTx.member.deleteMany.mockImplementation(async () => { order.push('member'); return { count: 0 }; });
      mockTx.branch.deleteMany.mockImplementation(async () => { order.push('branch'); return { count: 0 }; });

      await service.hardDelete(TENANT_ID);

      expect(order.indexOf('staff')).toBeLessThan(order.indexOf('member'));
      expect(order.indexOf('visitor')).toBeLessThan(order.indexOf('member'));
      expect(order.indexOf('member')).toBeLessThan(order.indexOf('branch'));
    });
  });

  describe('findOne', () => {
    it('finds a soft-deleted tenant (unlike findAll, does not filter deletedAt)', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, deletedAt: new Date() });

      const result = await service.findOne(TENANT_ID);

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: TENANT_ID } });
      expect(result).toEqual(expect.objectContaining({ id: TENANT_ID }));
    });

    it('throws NotFoundException when no tenant exists with that id at all', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findOne(TENANT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create (default org structure seeding)', () => {
    beforeEach(() => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null); // slug not taken
      mockPrisma.tenant.create.mockResolvedValue({ id: TENANT_ID, name: 'Grace Chapel', slug: 'grace-chapel' });
      mockPrisma.permission.findMany.mockResolvedValue([{ id: 'perm-1' }]);
      mockPrisma.role.create.mockResolvedValue({ id: 'role-1' });
      mockDynamicModuleDefinitions.create.mockResolvedValue({ id: 'dept-module-1' });
    });

    it('does nothing beyond creating the tenant row when no adminEmail is given', async () => {
      const result = await service.create({ name: 'Grace Chapel', slug: 'grace-chapel' } as any);

      expect(result.temporaryPassword).toBeNull();
      expect(mockPrisma.configItem.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.branch.create).not.toHaveBeenCalled();
    });

    it('seeds three branch_type ConfigItems (top_level/branch/sub_branch) for a brand-new tenant', async () => {
      await service.create({ name: 'Grace Chapel', slug: 'grace-chapel', adminEmail: 'admin@grace.test' } as any);

      expect(mockPrisma.configItem.createMany).toHaveBeenCalledWith({
        data: [
          { tenantId: TENANT_ID, namespace: 'branch_type', key: 'top_level', label: 'Top Level', value: {}, sortOrder: 0 },
          { tenantId: TENANT_ID, namespace: 'branch_type', key: 'branch', label: 'Branch', value: {}, sortOrder: 1 },
          { tenantId: TENANT_ID, namespace: 'branch_type', key: 'sub_branch', label: 'Sub Branch', value: {}, sortOrder: 2 },
        ],
      });
    });

    it('seeds the three HierarchyLevelDefinition rows reproducing the reference org-chart shape, leaving sub_branch uncolored so the frontend depth-rotation takes over', async () => {
      await service.create({ name: 'Grace Chapel', slug: 'grace-chapel', adminEmail: 'admin@grace.test' } as any);

      expect(mockPrisma.hierarchyLevelDefinition.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ branchTypeKey: 'top_level', allowedChildTypeKeys: ['branch'], color: '#2563EB' }),
          expect.objectContaining({ branchTypeKey: 'branch', allowedParentTypeKeys: ['top_level'], allowedChildTypeKeys: ['sub_branch'], color: '#16A34A' }),
          expect.objectContaining({ branchTypeKey: 'sub_branch', allowedParentTypeKeys: ['branch', 'sub_branch'], allowedChildTypeKeys: ['sub_branch'] }),
        ],
      });

      const subBranchRow = mockPrisma.hierarchyLevelDefinition.createMany.mock.calls[0][0].data[2];
      expect(subBranchRow.color).toBeUndefined();
    });

    it('creates one root top_level Branch marked as headquarters', async () => {
      await service.create({ name: 'Grace Chapel', slug: 'grace-chapel', adminEmail: 'admin@grace.test' } as any);

      expect(mockPrisma.branch.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT_ID, name: 'Grace Chapel Head Office', branchType: 'top_level', isHeadquarters: true },
      });
    });
  });
});
