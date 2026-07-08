import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SmallGroupMembershipsService } from '../src/small-groups/small-group-memberships.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('SmallGroupMembershipsService', () => {
  let service: SmallGroupMembershipsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    smallGroupMembership: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    smallGroup: { findFirst: jest.fn() },
    member: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [SmallGroupMembershipsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(SmallGroupMembershipsService);
  });

  describe('create', () => {
    const baseDto = { smallGroupId: 'group-1', memberId: 'member-1' };

    it('rejects when smallGroupId does not resolve within the tenant', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValue(null);
      await expect(service.create(TENANT_ID, baseDto as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects when memberId does not resolve within the tenant', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValue({ id: 'group-1', capacity: null });
      mockPrisma.member.findFirst.mockResolvedValue(null);
      await expect(service.create(TENANT_ID, baseDto as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects a second membership for the same member/group pair', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValue({ id: 'group-1', capacity: null });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.smallGroupMembership.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(TENANT_ID, baseDto as any)).rejects.toThrow(ConflictException);
    });

    it('rejects a new membership once the group has reached capacity', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValue({ id: 'group-1', capacity: 2 });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.smallGroupMembership.findFirst.mockResolvedValue(null);
      mockPrisma.smallGroupMembership.count.mockResolvedValue(2);

      await expect(service.create(TENANT_ID, baseDto as any)).rejects.toThrow(ConflictException);
      expect(mockPrisma.smallGroupMembership.create).not.toHaveBeenCalled();
    });

    it('allows a new membership when the group has not reached capacity', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValue({ id: 'group-1', capacity: 2 });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.smallGroupMembership.findFirst.mockResolvedValue(null);
      mockPrisma.smallGroupMembership.count.mockResolvedValue(1);
      mockPrisma.smallGroupMembership.create.mockResolvedValue({ id: 'sgm-1' });

      await service.create(TENANT_ID, baseDto as any);

      expect(mockPrisma.smallGroupMembership.create).toHaveBeenCalled();
    });

    it('defaults role to "member" and joinedAt to now when omitted', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValue({ id: 'group-1', capacity: null });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.smallGroupMembership.findFirst.mockResolvedValue(null);
      mockPrisma.smallGroupMembership.create.mockResolvedValue({ id: 'sgm-1' });

      await service.create(TENANT_ID, baseDto as any);

      expect(mockPrisma.smallGroupMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'member', joinedAt: expect.any(Date) }) }),
      );
    });

    it('allows a co-leader alongside an existing leader', async () => {
      mockPrisma.smallGroup.findFirst.mockResolvedValue({ id: 'group-1', capacity: null });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-2' });
      mockPrisma.smallGroupMembership.findFirst.mockResolvedValue(null);
      mockPrisma.smallGroupMembership.create.mockResolvedValue({ id: 'sgm-2', role: 'co_leader' });

      await service.create(TENANT_ID, { smallGroupId: 'group-1', memberId: 'member-2', role: 'co_leader' } as any);

      expect(mockPrisma.smallGroupMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'co_leader' }) }),
      );
    });
  });

  describe('remove', () => {
    it('deactivates the membership rather than deleting the row', async () => {
      mockPrisma.smallGroupMembership.findFirst.mockResolvedValue({ id: 'sgm-1' });
      mockPrisma.smallGroupMembership.update.mockResolvedValue({ id: 'sgm-1', isActive: false });

      await service.remove(TENANT_ID, 'sgm-1');

      expect(mockPrisma.smallGroupMembership.update).toHaveBeenCalledWith({
        where: { id: 'sgm-1' },
        data: { isActive: false },
      });
    });
  });

  describe('update', () => {
    it('cannot change smallGroupId/memberId — only role/isActive are passed through', async () => {
      mockPrisma.smallGroupMembership.findFirst.mockResolvedValue({ id: 'sgm-1' });
      mockPrisma.smallGroupMembership.update.mockResolvedValue({ id: 'sgm-1', role: 'leader' });

      await service.update(TENANT_ID, 'sgm-1', { role: 'leader' } as any);

      expect(mockPrisma.smallGroupMembership.update).toHaveBeenCalledWith({
        where: { id: 'sgm-1' },
        data: { role: 'leader', isActive: undefined },
      });
    });
  });
});
