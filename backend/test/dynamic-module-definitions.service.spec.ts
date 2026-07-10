import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DynamicModuleDefinitionsService } from '../src/dynamic-modules/dynamic-module-definitions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ApprovalWorkflowsService } from '../src/approval-workflows/approval-workflows.service';

describe('DynamicModuleDefinitionsService', () => {
  let service: DynamicModuleDefinitionsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    dynamicModuleDefinition: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    permission: { createMany: jest.fn(), findMany: jest.fn() },
    role: { findMany: jest.fn() },
    rolePermission: { createMany: jest.fn() },
  };

  const mockApprovalWorkflows = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DynamicModuleDefinitionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ApprovalWorkflowsService, useValue: mockApprovalWorkflows },
      ],
    }).compile();
    service = moduleRef.get(DynamicModuleDefinitionsService);
  });

  describe('create', () => {
    it('rejects a duplicate key', async () => {
      mockPrisma.dynamicModuleDefinition.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create(TENANT_ID, { key: 'committees', label: 'Committees' } as any)).rejects.toThrow(ConflictException);
    });

    it('creates a definition and grants generated permission codes to system roles', async () => {
      mockPrisma.dynamicModuleDefinition.findUnique.mockResolvedValue(null);
      mockPrisma.dynamicModuleDefinition.create.mockResolvedValue({ id: 'def-1', key: 'committees', label: 'Committees' });
      mockPrisma.permission.findMany.mockResolvedValue([
        { id: 'p1', code: 'dynamicmodule.def-1.create' },
        { id: 'p2', code: 'dynamicmodule.def-1.read' },
        { id: 'p3', code: 'dynamicmodule.def-1.update' },
        { id: 'p4', code: 'dynamicmodule.def-1.delete' },
        { id: 'p5', code: 'dynamicmodule.def-1.approve' },
      ]);
      mockPrisma.role.findMany.mockResolvedValue([{ id: 'role-1' }]);

      const result = await service.create(TENANT_ID, { key: 'committees', label: 'Committees' } as any);

      expect(result).toEqual({ id: 'def-1', key: 'committees', label: 'Committees' });
      expect(mockPrisma.permission.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.objectContaining({ code: 'dynamicmodule.def-1.create' })]),
          skipDuplicates: true,
        }),
      );
      expect(mockPrisma.rolePermission.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([{ roleId: 'role-1', permissionId: 'p1' }]),
        }),
      );
    });

    it('validates the approval workflow belongs to this tenant when given', async () => {
      mockPrisma.dynamicModuleDefinition.findUnique.mockResolvedValue(null);
      mockApprovalWorkflows.findOne.mockResolvedValue({ id: 'wf-1' });
      mockPrisma.dynamicModuleDefinition.create.mockResolvedValue({ id: 'def-1' });
      mockPrisma.permission.findMany.mockResolvedValue([]);
      mockPrisma.role.findMany.mockResolvedValue([]);

      await service.create(TENANT_ID, { key: 'committees', label: 'Committees', approvalWorkflowId: 'wf-1' } as any);

      expect(mockApprovalWorkflows.findOne).toHaveBeenCalledWith(TENANT_ID, 'wf-1');
    });
  });

  describe('findOne', () => {
    it('throws when not found', async () => {
      mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT_ID, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('rejects an empty statuses array', async () => {
      mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({ id: 'def-1' });
      await expect(service.update(TENANT_ID, 'def-1', { statuses: [] } as any)).rejects.toThrow(BadRequestException);
    });
  });
});
