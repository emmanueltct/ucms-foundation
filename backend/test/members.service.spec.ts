import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MembersService } from '../src/members/members.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FamiliesService } from '../src/families/families.service';

describe('MembersService', () => {
  let service: MembersService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    member: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    branch: {
      findFirst: jest.fn(),
    },
  };

  const mockFamilies = {
    findOne: jest.fn(),
    clearHeadIfMember: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FamiliesService, useValue: mockFamilies },
      ],
    }).compile();
    service = moduleRef.get(MembersService);
  });

  describe('create', () => {
    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, { branchId: 'missing', firstName: 'Jean', lastName: 'Uwimana' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when familyId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockFamilies.findOne.mockRejectedValue(new NotFoundException({ code: 'FAMILY_NOT_FOUND' }));

      await expect(
        service.create(TENANT_ID, {
          branchId: 'branch-1',
          familyId: 'missing-family',
          firstName: 'Jean',
          lastName: 'Uwimana',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate membershipNumber within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'existing-member' });

      await expect(
        service.create(TENANT_ID, {
          branchId: 'branch-1',
          membershipNumber: 'MBR-0001',
          firstName: 'Jean',
          lastName: 'Uwimana',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a member when branch/family/membershipNumber all check out', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.member.findFirst.mockResolvedValue(null);
      mockPrisma.member.create.mockResolvedValue({ id: 'mem-1' });

      await service.create(TENANT_ID, {
        branchId: 'branch-1',
        membershipNumber: 'MBR-0001',
        firstName: 'Jean',
        lastName: 'Uwimana',
      });

      expect(mockPrisma.member.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: TENANT_ID, branchId: 'branch-1', membershipStatus: 'active' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('clears the family head reference when familyId changes away from the current family', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID, familyId: 'fam-old' });
      mockFamilies.findOne.mockResolvedValue({ id: 'fam-new' });
      mockPrisma.member.update.mockResolvedValue({ id: 'mem-1', familyId: 'fam-new' });

      await service.update(TENANT_ID, 'mem-1', { familyId: 'fam-new' });

      expect(mockFamilies.clearHeadIfMember).toHaveBeenCalledWith(TENANT_ID, 'mem-1');
    });

    it('does not touch the family head reference when familyId is unchanged', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID, familyId: 'fam-1' });
      mockPrisma.member.update.mockResolvedValue({ id: 'mem-1' });

      await service.update(TENANT_ID, 'mem-1', { firstName: 'Jean-Pierre' });

      expect(mockFamilies.clearHeadIfMember).not.toHaveBeenCalled();
    });
  });

  describe('transfer', () => {
    it('rejects when the target branch does not resolve within the tenant', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID });
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.transfer(TENANT_ID, 'mem-1', 'missing-branch')).rejects.toThrow(NotFoundException);
    });

    it('moves the member to the new branch', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID });
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-2' });
      mockPrisma.member.update.mockResolvedValue({ id: 'mem-1', branchId: 'branch-2' });

      await service.transfer(TENANT_ID, 'mem-1', 'branch-2');

      expect(mockPrisma.member.update).toHaveBeenCalledWith({ where: { id: 'mem-1' }, data: { branchId: 'branch-2' } });
    });
  });

  describe('softDelete', () => {
    it('soft-deletes the member and clears any family head reference pointing at them', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID });
      mockPrisma.member.update.mockResolvedValue({ id: 'mem-1', isActive: false });

      await service.softDelete(TENANT_ID, 'mem-1');

      expect(mockFamilies.clearHeadIfMember).toHaveBeenCalledWith(TENANT_ID, 'mem-1');
      expect(mockPrisma.member.update).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
    });
  });
});
