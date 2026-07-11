import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DepartmentsService } from '../src/departments/departments.service';
import { DynamicModuleDefinitionsService } from '../src/dynamic-modules/dynamic-module-definitions.service';
import { DynamicModuleRecordsService } from '../src/dynamic-modules/dynamic-module-records.service';
import { ResourceAssignmentsService } from '../src/resource-assignments/resource-assignments.service';
import { DepartmentScopeService } from '../src/common/department-scope/department-scope.service';
import { AuthenticatedUser } from '../src/common/interfaces/request-context.interface';

describe('DepartmentsService', () => {
  let service: DepartmentsService;

  const TENANT_ID = 'tenant-1';
  const MODULE_ID = 'departments-module-1';

  const baseUser: AuthenticatedUser = {
    userId: 'user-1',
    tenantId: TENANT_ID,
    email: 'admin@example.com',
    isPlatformAdmin: false,
    permissions: [],
    roles: [],
  };

  const mockDefinitions = { findByKey: jest.fn() };
  const mockRecords = { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), softDelete: jest.fn() };
  const mockResourceAssignments = { resolveForScope: jest.fn(), create: jest.fn(), remove: jest.fn() };
  const mockDepartmentScope = { isLeaderOf: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDefinitions.findByKey.mockResolvedValue({ id: MODULE_ID, key: 'departments' });
    mockRecords.findOne.mockResolvedValue({ id: 'dept-1' });
    mockDepartmentScope.isLeaderOf.mockResolvedValue(false);

    const moduleRef = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: DynamicModuleDefinitionsService, useValue: mockDefinitions },
        { provide: DynamicModuleRecordsService, useValue: mockRecords },
        { provide: ResourceAssignmentsService, useValue: mockResourceAssignments },
        { provide: DepartmentScopeService, useValue: mockDepartmentScope },
      ],
    }).compile();
    service = moduleRef.get(DepartmentsService);
  });

  describe('create', () => {
    it('resolves the tenant\'s departments module by key and creates a record under it', async () => {
      mockRecords.create.mockResolvedValue({ id: 'dept-1', title: 'Finance' });

      await service.create(TENANT_ID, { name: 'Finance' }, baseUser);

      expect(mockDefinitions.findByKey).toHaveBeenCalledWith(TENANT_ID, 'departments');
      expect(mockRecords.create).toHaveBeenCalledWith(
        TENANT_ID,
        MODULE_ID,
        { title: 'Finance', parentRecordId: undefined, customFields: undefined },
        baseUser,
      );
    });
  });

  describe('findAll / findOne / update / remove', () => {
    it('findAll delegates to DynamicModuleRecordsService.findAll scoped to the departments module', async () => {
      mockRecords.findAll.mockResolvedValue([]);
      await service.findAll(TENANT_ID, baseUser);
      expect(mockRecords.findAll).toHaveBeenCalledWith(TENANT_ID, MODULE_ID, {}, baseUser);
    });

    it('findOne delegates to DynamicModuleRecordsService.findOne', async () => {
      mockRecords.findOne.mockResolvedValue({ id: 'dept-1' });
      await service.findOne(TENANT_ID, 'dept-1', baseUser);
      expect(mockRecords.findOne).toHaveBeenCalledWith(TENANT_ID, MODULE_ID, 'dept-1', baseUser);
    });

    it('remove delegates to DynamicModuleRecordsService.softDelete', async () => {
      mockRecords.softDelete.mockResolvedValue({ id: 'dept-1' });
      await service.remove(TENANT_ID, 'dept-1', baseUser);
      expect(mockRecords.softDelete).toHaveBeenCalledWith(TENANT_ID, MODULE_ID, 'dept-1', baseUser);
    });
  });

  describe('resource assignment', () => {
    it('listResources confirms the department exists (read permission) then resolves its scope', async () => {
      mockRecords.findOne.mockResolvedValue({ id: 'dept-1' });
      mockResourceAssignments.resolveForScope.mockResolvedValue([{ id: 'ra-1' }]);

      const result = await service.listResources(TENANT_ID, 'dept-1', baseUser);

      expect(mockRecords.findOne).toHaveBeenCalledWith(TENANT_ID, MODULE_ID, 'dept-1', baseUser);
      expect(mockResourceAssignments.resolveForScope).toHaveBeenCalledWith(TENANT_ID, 'dynamic_module_record', 'dept-1');
      expect(result).toEqual([{ id: 'ra-1' }]);
    });

    it('assignResource rejects a caller with neither the module-scoped update permission nor leadership of this department', async () => {
      const scopedUser = { ...baseUser, permissions: [] };

      await expect(
        service.assignResource(TENANT_ID, 'dept-1', { resourceType: 'module', resourceKey: 'mod-1' }, scopedUser),
      ).rejects.toThrow(ForbiddenException);
      expect(mockResourceAssignments.create).not.toHaveBeenCalled();
    });

    it('assignResource succeeds for a caller who leads this specific department, even without the module-wide permission', async () => {
      const leaderUser = { ...baseUser, permissions: [] };
      mockDepartmentScope.isLeaderOf.mockResolvedValue(true);
      mockResourceAssignments.create.mockResolvedValue({ id: 'ra-1' });

      const result = await service.assignResource(TENANT_ID, 'dept-1', { resourceType: 'module', resourceKey: 'mod-1' }, leaderUser);

      expect(mockDepartmentScope.isLeaderOf).toHaveBeenCalledWith(TENANT_ID, leaderUser.userId, 'dept-1');
      expect(result).toEqual({ id: 'ra-1' });
    });

    it('assignResource succeeds for a caller with the module-scoped update permission', async () => {
      const authorizedUser = { ...baseUser, permissions: [`dynamicmodule.${MODULE_ID}.update`] };
      mockRecords.findOne.mockResolvedValue({ id: 'dept-1' });
      mockResourceAssignments.create.mockResolvedValue({ id: 'ra-1' });

      const result = await service.assignResource(TENANT_ID, 'dept-1', { resourceType: 'module', resourceKey: 'mod-1' }, authorizedUser);

      expect(mockResourceAssignments.create).toHaveBeenCalledWith(TENANT_ID, {
        scopeEntityType: 'dynamic_module_record',
        scopeEntityId: 'dept-1',
        resourceType: 'module',
        resourceKey: 'mod-1',
      });
      expect(result).toEqual({ id: 'ra-1' });
    });

    it('assignResource is unrestricted for a platform admin regardless of permissions', async () => {
      const platformAdmin = { ...baseUser, isPlatformAdmin: true, permissions: [] };
      mockRecords.findOne.mockResolvedValue({ id: 'dept-1' });
      mockResourceAssignments.create.mockResolvedValue({ id: 'ra-1' });

      await expect(
        service.assignResource(TENANT_ID, 'dept-1', { resourceType: 'module', resourceKey: 'mod-1' }, platformAdmin),
      ).resolves.toBeDefined();
    });

    it('removeResource rejects a caller without the module-scoped update permission', async () => {
      const scopedUser = { ...baseUser, permissions: [] };

      await expect(service.removeResource(TENANT_ID, 'dept-1', 'ra-1', scopedUser)).rejects.toThrow(ForbiddenException);
      expect(mockResourceAssignments.remove).not.toHaveBeenCalled();
    });

    it('removeResource succeeds for a caller with the module-scoped update permission', async () => {
      const authorizedUser = { ...baseUser, permissions: [`dynamicmodule.${MODULE_ID}.update`] };
      mockRecords.findOne.mockResolvedValue({ id: 'dept-1' });
      mockResourceAssignments.remove.mockResolvedValue({ id: 'ra-1' });

      const result = await service.removeResource(TENANT_ID, 'dept-1', 'ra-1', authorizedUser);

      expect(mockResourceAssignments.remove).toHaveBeenCalledWith(TENANT_ID, 'ra-1');
      expect(result).toEqual({ id: 'ra-1' });
    });
  });
});
