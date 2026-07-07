import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FamiliesService } from '../src/families/families.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('FamiliesService', () => {
  let service: FamiliesService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    family: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    member: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [FamiliesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(FamiliesService);
  });

  describe('findOne', () => {
    it('throws NotFoundException when the family does not exist in this tenant', async () => {
      mockPrisma.family.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT_ID, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setHead', () => {
    it('rejects when the member does not belong to this family', async () => {
      mockPrisma.family.findFirst.mockResolvedValue({ id: 'fam-1', tenantId: TENANT_ID });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', familyId: 'some-other-family' });

      await expect(service.setHead(TENANT_ID, 'fam-1', 'mem-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects when the member does not exist', async () => {
      mockPrisma.family.findFirst.mockResolvedValue({ id: 'fam-1', tenantId: TENANT_ID });
      mockPrisma.member.findFirst.mockResolvedValue(null);

      await expect(service.setHead(TENANT_ID, 'fam-1', 'missing-member')).rejects.toThrow(BadRequestException);
    });

    it('sets the head when the member belongs to this family', async () => {
      mockPrisma.family.findFirst.mockResolvedValue({ id: 'fam-1', tenantId: TENANT_ID });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', familyId: 'fam-1' });
      mockPrisma.family.update.mockResolvedValue({ id: 'fam-1', headOfFamilyId: 'mem-1' });

      await service.setHead(TENANT_ID, 'fam-1', 'mem-1');

      expect(mockPrisma.family.update).toHaveBeenCalledWith({ where: { id: 'fam-1' }, data: { headOfFamilyId: 'mem-1' } });
    });

    it('clears the head when memberId is omitted', async () => {
      mockPrisma.family.findFirst.mockResolvedValue({ id: 'fam-1', tenantId: TENANT_ID });
      mockPrisma.family.update.mockResolvedValue({ id: 'fam-1', headOfFamilyId: null });

      await service.setHead(TENANT_ID, 'fam-1', undefined);

      expect(mockPrisma.member.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.family.update).toHaveBeenCalledWith({ where: { id: 'fam-1' }, data: { headOfFamilyId: null } });
    });
  });

  describe('softDelete', () => {
    it('deactivates the family without touching its members', async () => {
      mockPrisma.family.findFirst.mockResolvedValue({ id: 'fam-1', tenantId: TENANT_ID });
      mockPrisma.family.update.mockResolvedValue({ id: 'fam-1', isActive: false });

      await service.softDelete(TENANT_ID, 'fam-1');

      expect(mockPrisma.family.update).toHaveBeenCalledWith({
        where: { id: 'fam-1' },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
      expect(mockPrisma.member.findMany).not.toHaveBeenCalled();
    });
  });

  describe('clearHeadIfMember', () => {
    it('clears headOfFamilyId on any family currently pointing at the given member', async () => {
      mockPrisma.family.updateMany.mockResolvedValue({ count: 1 });

      await service.clearHeadIfMember(TENANT_ID, 'mem-1');

      expect(mockPrisma.family.updateMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, headOfFamilyId: 'mem-1' },
        data: { headOfFamilyId: null },
      });
    });
  });
});
