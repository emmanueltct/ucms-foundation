import { Test } from '@nestjs/testing';
import { DepartmentScopeService } from '../src/common/department-scope/department-scope.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DynamicModuleRecordsService } from '../src/dynamic-modules/dynamic-module-records.service';

describe('DepartmentScopeService', () => {
  let service: DepartmentScopeService;

  const TENANT_ID = 'tenant-1';
  const MODULE_ID = 'departments-module-1';

  const mockPrisma = {
    user: { findFirst: jest.fn() },
    dynamicModuleDefinition: { findFirst: jest.fn() },
  };
  const mockRecords = { descendants: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DepartmentScopeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DynamicModuleRecordsService, useValue: mockRecords },
      ],
    }).compile();
    service = moduleRef.get(DepartmentScopeService);
  });

  describe('resolveVisibleDepartmentRecordIds', () => {
    it('returns null (unrestricted) when the user has no assignedDepartmentRecordId — the default', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedDepartmentRecordId: null });

      const result = await service.resolveVisibleDepartmentRecordIds(TENANT_ID, 'user-1');

      expect(result).toBeNull();
      expect(mockRecords.descendants).not.toHaveBeenCalled();
    });

    it("returns the user's own department plus its descendants when assigned", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedDepartmentRecordId: 'dept-parent' });
      mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({ id: MODULE_ID });
      mockRecords.descendants.mockResolvedValue([{ id: 'dept-child-1' }, { id: 'dept-child-2' }]);

      const result = await service.resolveVisibleDepartmentRecordIds(TENANT_ID, 'user-1');

      expect(result).toEqual(['dept-parent', 'dept-child-1', 'dept-child-2']);
      expect(mockRecords.descendants).toHaveBeenCalledWith(TENANT_ID, MODULE_ID, 'dept-parent', expect.objectContaining({ isPlatformAdmin: true }));
    });

    it('returns just the assigned department when no departments module definition exists yet', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedDepartmentRecordId: 'dept-parent' });
      mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue(null);

      const result = await service.resolveVisibleDepartmentRecordIds(TENANT_ID, 'user-1');

      expect(result).toEqual(['dept-parent']);
    });
  });

  describe('isLeaderOf', () => {
    it('returns true when the user is the leader of exactly this department', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedDepartmentRecordId: 'dept-1', departmentRole: 'leader' });

      expect(await service.isLeaderOf(TENANT_ID, 'user-1', 'dept-1')).toBe(true);
    });

    it('returns false when the user is staff (not leader) of this department', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedDepartmentRecordId: 'dept-1', departmentRole: 'staff' });

      expect(await service.isLeaderOf(TENANT_ID, 'user-1', 'dept-1')).toBe(false);
    });

    it('returns false when the user leads a different department', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedDepartmentRecordId: 'dept-other', departmentRole: 'leader' });

      expect(await service.isLeaderOf(TENANT_ID, 'user-1', 'dept-1')).toBe(false);
    });

    it('returns false when the user has no department at all', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedDepartmentRecordId: null, departmentRole: null });

      expect(await service.isLeaderOf(TENANT_ID, 'user-1', 'dept-1')).toBe(false);
    });
  });
});
