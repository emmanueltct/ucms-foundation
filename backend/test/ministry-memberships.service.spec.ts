import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MinistryMembershipsService } from '../src/ministries/ministry-memberships.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('MinistryMembershipsService', () => {
  let service: MinistryMembershipsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    ministryMembership: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    ministry: { findFirst: jest.fn() },
    member: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [MinistryMembershipsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(MinistryMembershipsService);
  });

  describe('create', () => {
    const baseDto = { ministryId: 'ministry-1', memberId: 'member-1' };

    it('rejects when ministryId does not resolve within the tenant', async () => {
      mockPrisma.ministry.findFirst.mockResolvedValue(null);
      await expect(service.create(TENANT_ID, baseDto as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects when memberId does not resolve within the tenant', async () => {
      mockPrisma.ministry.findFirst.mockResolvedValue({ id: 'ministry-1' });
      mockPrisma.member.findFirst.mockResolvedValue(null);
      await expect(service.create(TENANT_ID, baseDto as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects a second membership for the same member/ministry pair', async () => {
      mockPrisma.ministry.findFirst.mockResolvedValue({ id: 'ministry-1' });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.ministryMembership.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(TENANT_ID, baseDto as any)).rejects.toThrow(ConflictException);
    });

    it('defaults role to "member" and joinedAt to now when omitted', async () => {
      mockPrisma.ministry.findFirst.mockResolvedValue({ id: 'ministry-1' });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.ministryMembership.findFirst.mockResolvedValue(null);
      mockPrisma.ministryMembership.create.mockResolvedValue({ id: 'mm-1' });

      await service.create(TENANT_ID, baseDto as any);

      expect(mockPrisma.ministryMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'member', joinedAt: expect.any(Date) }) }),
      );
    });

    it('allows a second leader for the same ministry (co-leadership)', async () => {
      mockPrisma.ministry.findFirst.mockResolvedValue({ id: 'ministry-1' });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-2' });
      mockPrisma.ministryMembership.findFirst.mockResolvedValue(null); // no existing record for THIS member
      mockPrisma.ministryMembership.create.mockResolvedValue({ id: 'mm-2', role: 'leader' });

      await service.create(TENANT_ID, { ministryId: 'ministry-1', memberId: 'member-2', role: 'leader' } as any);

      expect(mockPrisma.ministryMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'leader' }) }),
      );
    });
  });

  describe('remove', () => {
    it('deactivates the membership rather than deleting the row', async () => {
      mockPrisma.ministryMembership.findFirst.mockResolvedValue({ id: 'mm-1' });
      mockPrisma.ministryMembership.update.mockResolvedValue({ id: 'mm-1', isActive: false });

      await service.remove(TENANT_ID, 'mm-1');

      expect(mockPrisma.ministryMembership.update).toHaveBeenCalledWith({
        where: { id: 'mm-1' },
        data: { isActive: false },
      });
    });
  });

  describe('update', () => {
    it('cannot change ministryId/memberId — only role/isActive are passed through', async () => {
      mockPrisma.ministryMembership.findFirst.mockResolvedValue({ id: 'mm-1' });
      mockPrisma.ministryMembership.update.mockResolvedValue({ id: 'mm-1', role: 'leader' });

      await service.update(TENANT_ID, 'mm-1', { role: 'leader' } as any);

      expect(mockPrisma.ministryMembership.update).toHaveBeenCalledWith({
        where: { id: 'mm-1' },
        data: { role: 'leader', isActive: undefined },
      });
    });
  });
});
