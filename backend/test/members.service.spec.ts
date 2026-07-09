import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MembersService } from '../src/members/members.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FamiliesService } from '../src/families/families.service';
import { CustomFieldsService } from '../src/custom-fields/custom-fields.service';

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

  const mockCustomFields = {
    assertRequiredFieldsProvided: jest.fn().mockResolvedValue(undefined),
    setValues: jest.fn().mockResolvedValue(undefined),
    getValues: jest.fn().mockResolvedValue({}),
    getValuesForMany: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCustomFields.assertRequiredFieldsProvided.mockResolvedValue(undefined);
    mockCustomFields.setValues.mockResolvedValue(undefined);
    mockCustomFields.getValues.mockResolvedValue({});
    mockCustomFields.getValuesForMany.mockResolvedValue({});
    const moduleRef = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FamiliesService, useValue: mockFamilies },
        { provide: CustomFieldsService, useValue: mockCustomFields },
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

    it('checks required custom fields before writing the member row, and persists+returns any provided', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.member.findFirst.mockResolvedValue(null);
      mockPrisma.member.create.mockResolvedValue({ id: 'mem-1' });

      const result = await service.create(TENANT_ID, {
        branchId: 'branch-1',
        firstName: 'Jean',
        lastName: 'Uwimana',
        customFields: { confirmation_date: '2020-06-01' },
      });

      expect(mockCustomFields.assertRequiredFieldsProvided).toHaveBeenCalledWith(TENANT_ID, 'member', {
        confirmation_date: '2020-06-01',
      });
      expect(mockCustomFields.setValues).toHaveBeenCalledWith(TENANT_ID, 'member', 'mem-1', {
        confirmation_date: '2020-06-01',
      });
      expect(result.customFields).toEqual({ confirmation_date: '2020-06-01' });
    });

    it('propagates a missing-required-custom-field rejection before creating the member row', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockCustomFields.assertRequiredFieldsProvided.mockRejectedValue(
        new Error('CUSTOM_FIELD_REQUIRED'),
      );

      await expect(
        service.create(TENANT_ID, { branchId: 'branch-1', firstName: 'Jean', lastName: 'Uwimana' }),
      ).rejects.toThrow('CUSTOM_FIELD_REQUIRED');

      expect(mockPrisma.member.create).not.toHaveBeenCalled();
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

    it('persists provided custom field values and returns the merged current state', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID, familyId: null });
      mockPrisma.member.update.mockResolvedValue({ id: 'mem-1' });
      mockCustomFields.getValues.mockResolvedValue({ confirmation_date: '2020-06-01', spiritual_gift: 'teaching' });

      const result = await service.update(TENANT_ID, 'mem-1', { customFields: { spiritual_gift: 'teaching' } });

      expect(mockCustomFields.setValues).toHaveBeenCalledWith(TENANT_ID, 'member', 'mem-1', { spiritual_gift: 'teaching' });
      expect(result.customFields).toEqual({ confirmation_date: '2020-06-01', spiritual_gift: 'teaching' });
    });
  });

  describe('findAll', () => {
    it('batch-attaches custom field values to every returned member', async () => {
      mockPrisma.member.findMany.mockResolvedValue([{ id: 'mem-1' }, { id: 'mem-2' }]);
      mockPrisma.member.count.mockResolvedValue(2);
      mockCustomFields.getValuesForMany.mockResolvedValue({ 'mem-1': { confirmation_date: '2020-06-01' } });

      const result = await service.findAll(TENANT_ID, { page: 1, pageSize: 20 } as any);

      expect(mockCustomFields.getValuesForMany).toHaveBeenCalledWith(TENANT_ID, 'member', ['mem-1', 'mem-2']);
      expect(result.items[0].customFields).toEqual({ confirmation_date: '2020-06-01' });
      expect(result.items[1].customFields).toEqual({});
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

  describe('findAllForExport', () => {
    it('applies the same filters as findAll but with no pagination, capped at 5000 rows', async () => {
      mockPrisma.member.findMany.mockResolvedValue([{ id: 'mem-1' }, { id: 'mem-2' }]);

      const result = await service.findAllForExport(TENANT_ID, { branchId: 'branch-1' } as any);

      expect(mockPrisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, branchId: 'branch-1' }),
          take: 5000,
        }),
      );
      expect(mockPrisma.member.findMany.mock.calls[0][0]).not.toHaveProperty('skip');
      expect(result).toHaveLength(2);
    });
  });
});
