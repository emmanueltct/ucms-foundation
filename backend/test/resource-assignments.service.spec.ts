import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ResourceAssignmentsService } from '../src/resource-assignments/resource-assignments.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ResourceAssignmentsService', () => {
  let service: ResourceAssignmentsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    resourceAssignment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ResourceAssignmentsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(ResourceAssignmentsService);
  });

  describe('create', () => {
    const dto = { scopeEntityType: 'branch', scopeEntityId: 'branch-1', resourceType: 'module', resourceKey: 'module-1' };

    it('rejects a duplicate assignment for the same scope/resource pair', async () => {
      mockPrisma.resourceAssignment.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(TENANT_ID, dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.resourceAssignment.create).not.toHaveBeenCalled();
    });

    it('creates the assignment when no duplicate exists', async () => {
      mockPrisma.resourceAssignment.findUnique.mockResolvedValue(null);
      mockPrisma.resourceAssignment.create.mockResolvedValue({ id: 'new-assignment', tenantId: TENANT_ID, ...dto });

      const result = await service.create(TENANT_ID, dto);

      expect(mockPrisma.resourceAssignment.create).toHaveBeenCalledWith({ data: { tenantId: TENANT_ID, ...dto } });
      expect(result.id).toBe('new-assignment');
    });
  });

  describe('findAll', () => {
    it('filters by scopeEntityType, scopeEntityId, and resourceType when provided', async () => {
      mockPrisma.resourceAssignment.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID, { scopeEntityType: 'branch', scopeEntityId: 'branch-1', resourceType: 'module' });

      expect(mockPrisma.resourceAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, scopeEntityType: 'branch', scopeEntityId: 'branch-1', resourceType: 'module' },
        }),
      );
    });

    it('omits filters that were not provided', async () => {
      mockPrisma.resourceAssignment.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID, {});

      expect(mockPrisma.resourceAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: TENANT_ID } }));
    });
  });

  describe('resolveForScope', () => {
    it('returns every assignment for one specific scope entity', async () => {
      const rows = [{ id: 'a1', resourceType: 'module', resourceKey: 'm1' }];
      mockPrisma.resourceAssignment.findMany.mockResolvedValue(rows);

      const result = await service.resolveForScope(TENANT_ID, 'branch', 'branch-1');

      expect(mockPrisma.resourceAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, scopeEntityType: 'branch', scopeEntityId: 'branch-1' } }),
      );
      expect(result).toEqual(rows);
    });
  });

  describe('remove', () => {
    it('rejects when the assignment does not resolve within the tenant', async () => {
      mockPrisma.resourceAssignment.findFirst.mockResolvedValue(null);

      await expect(service.remove(TENANT_ID, 'missing')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.resourceAssignment.delete).not.toHaveBeenCalled();
    });

    it('deletes the assignment when it exists', async () => {
      mockPrisma.resourceAssignment.findFirst.mockResolvedValue({ id: 'a1', tenantId: TENANT_ID });
      mockPrisma.resourceAssignment.delete.mockResolvedValue({ id: 'a1' });

      const result = await service.remove(TENANT_ID, 'a1');

      expect(mockPrisma.resourceAssignment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
      expect(result).toEqual({ id: 'a1' });
    });
  });
});
