import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MemberActivitiesService } from '../src/members/member-activities.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CustomFieldsService } from '../src/custom-fields/custom-fields.service';

describe('MemberActivitiesService', () => {
  let service: MemberActivitiesService;

  const TENANT_ID = 'tenant-1';
  const USER_ID = 'user-1';

  const mockPrisma = {
    memberActivity: { create: jest.fn(), findMany: jest.fn() },
    member: { findFirst: jest.fn() },
  };

  const mockCustomFieldsService = {
    assertRequiredFieldsProvided: jest.fn(),
    setValues: jest.fn(),
    getValuesForMany: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCustomFieldsService.assertRequiredFieldsProvided.mockResolvedValue(undefined);
    mockCustomFieldsService.getValuesForMany.mockResolvedValue({});
    const moduleRef = await Test.createTestingModule({
      providers: [
        MemberActivitiesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CustomFieldsService, useValue: mockCustomFieldsService },
      ],
    }).compile();
    service = moduleRef.get(MemberActivitiesService);
  });

  describe('entityTypeFor', () => {
    it('composes the Custom Fields entityType from the activity type', () => {
      expect(service.entityTypeFor('baptism')).toBe('member_activity:baptism');
    });
  });

  describe('addActivity', () => {
    const dto = { activityType: 'training_completed', outcome: 'Completed with distinction.' };

    it('rejects when the member does not exist', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);

      await expect(service.addActivity(TENANT_ID, 'member-1', USER_ID, dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('validates required custom fields against member_activity:{type} before creating the row', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockCustomFieldsService.assertRequiredFieldsProvided.mockRejectedValue(new BadRequestException());

      await expect(service.addActivity(TENANT_ID, 'member-1', USER_ID, dto as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockCustomFieldsService.assertRequiredFieldsProvided).toHaveBeenCalledWith(
        TENANT_ID,
        'member_activity:training_completed',
        undefined,
      );
      expect(mockPrisma.memberActivity.create).not.toHaveBeenCalled();
    });

    it('creates an activity with the acting user as performedByUserId', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.memberActivity.create.mockResolvedValue({ id: 'activity-1' });

      await service.addActivity(TENANT_ID, 'member-1', USER_ID, dto as any);

      expect(mockPrisma.memberActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          memberId: 'member-1',
          activityType: 'training_completed',
          outcome: 'Completed with distinction.',
          performedByUserId: USER_ID,
        }),
      });
    });

    it('persists provided custom fields against the type-specific entityType after creating the row', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.memberActivity.create.mockResolvedValue({ id: 'activity-1' });

      await service.addActivity(
        TENANT_ID,
        'member-1',
        USER_ID,
        { ...dto, customFields: { certificate_number: 'CERT-01' } } as any,
      );

      expect(mockCustomFieldsService.setValues).toHaveBeenCalledWith(
        TENANT_ID,
        'member_activity:training_completed',
        'activity-1',
        { certificate_number: 'CERT-01' },
      );
    });
  });

  describe('listActivities', () => {
    it('rejects when the member does not exist', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);

      await expect(service.listActivities(TENANT_ID, 'member-1')).rejects.toThrow(NotFoundException);
    });

    it('returns activities most recent first with their custom fields attached', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.memberActivity.findMany.mockResolvedValue([
        { id: 'activity-2', activityType: 'baptism' },
        { id: 'activity-1', activityType: 'baptism' },
      ]);
      mockCustomFieldsService.getValuesForMany.mockResolvedValue({ 'activity-1': { officiant: 'Pastor Jean' } });

      const result = await service.listActivities(TENANT_ID, 'member-1');

      expect(result[1].customFields).toEqual({ officiant: 'Pastor Jean' });
      expect(result[0].customFields).toEqual({});
    });
  });
});
