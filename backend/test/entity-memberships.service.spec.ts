import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityMembershipsService } from '../src/entity-memberships/entity-memberships.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('EntityMembershipsService', () => {
  let service: EntityMembershipsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    member: { findFirst: jest.fn() },
    dynamicModuleRecord: { findFirst: jest.fn() },
    entityMembership: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [EntityMembershipsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(EntityMembershipsService);
  });

  describe('create', () => {
    it('rejects when the member does not exist', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);
      await expect(
        service.create(TENANT_ID, { attachedToEntityType: 'branch', attachedToEntityId: 'b-1', memberId: 'm-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('validates a dynamicmodule: target actually exists', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'm-1' });
      mockPrisma.dynamicModuleRecord.findFirst.mockResolvedValue(null);
      await expect(
        service.create(TENANT_ID, { attachedToEntityType: 'dynamicmodule:def-1', attachedToEntityId: 'rec-1', memberId: 'm-1' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.dynamicModuleRecord.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'rec-1', tenantId: TENANT_ID, moduleDefinitionId: 'def-1' }) }),
      );
    });

    it('does not validate existence for non-dynamicmodule entity types', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'm-1' });
      mockPrisma.entityMembership.findFirst.mockResolvedValue(null);
      mockPrisma.entityMembership.create.mockResolvedValue({ id: 'em-1' });

      await service.create(TENANT_ID, { attachedToEntityType: 'branch', attachedToEntityId: 'b-1', memberId: 'm-1' });

      expect(mockPrisma.dynamicModuleRecord.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.entityMembership.create).toHaveBeenCalled();
    });

    it('rejects a duplicate membership for the same entity/member', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'm-1' });
      mockPrisma.entityMembership.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create(TENANT_ID, { attachedToEntityType: 'branch', attachedToEntityId: 'b-1', memberId: 'm-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('defaults role to "member" and joinedAt to now', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'm-1' });
      mockPrisma.entityMembership.findFirst.mockResolvedValue(null);
      mockPrisma.entityMembership.create.mockResolvedValue({ id: 'em-1' });

      await service.create(TENANT_ID, { attachedToEntityType: 'branch', attachedToEntityId: 'b-1', memberId: 'm-1' });

      expect(mockPrisma.entityMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'member', joinedAt: expect.any(Date) }) }),
      );
    });
  });

  describe('remove', () => {
    it('deactivates rather than deletes', async () => {
      mockPrisma.entityMembership.findFirst.mockResolvedValue({ id: 'em-1' });
      mockPrisma.entityMembership.update.mockResolvedValue({ id: 'em-1', isActive: false });

      await service.remove(TENANT_ID, 'em-1');

      expect(mockPrisma.entityMembership.update).toHaveBeenCalledWith({ where: { id: 'em-1' }, data: { isActive: false } });
    });

    it('throws when not found', async () => {
      mockPrisma.entityMembership.findFirst.mockResolvedValue(null);
      await expect(service.remove(TENANT_ID, 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
