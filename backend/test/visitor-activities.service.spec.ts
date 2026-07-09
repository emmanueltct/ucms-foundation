import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VisitorActivitiesService } from '../src/visitors/visitor-activities.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CustomFieldsService } from '../src/custom-fields/custom-fields.service';

describe('VisitorActivitiesService', () => {
  let service: VisitorActivitiesService;

  const TENANT_ID = 'tenant-1';
  const USER_ID = 'user-1';

  const mockPrisma = {
    visitorActivity: { create: jest.fn(), findMany: jest.fn() },
    visitor: { findFirst: jest.fn() },
    visitorGroup: { findFirst: jest.fn() },
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
        VisitorActivitiesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CustomFieldsService, useValue: mockCustomFieldsService },
      ],
    }).compile();
    service = moduleRef.get(VisitorActivitiesService);
  });

  describe('entityTypeFor', () => {
    it('composes the Custom Fields entityType from the activity type', () => {
      expect(service.entityTypeFor('baptism_class')).toBe('visitor_activity:baptism_class');
    });
  });

  describe('assertExactlyOneTarget', () => {
    it('rejects when neither visitorId nor visitorGroupId is given', () => {
      expect(() => service.assertExactlyOneTarget({})).toThrow(BadRequestException);
    });

    it('rejects when both visitorId and visitorGroupId are given', () => {
      expect(() => service.assertExactlyOneTarget({ visitorId: 'v1', visitorGroupId: 'g1' })).toThrow(
        BadRequestException,
      );
    });

    it('accepts exactly one target', () => {
      expect(() => service.assertExactlyOneTarget({ visitorId: 'v1' })).not.toThrow();
      expect(() => service.assertExactlyOneTarget({ visitorGroupId: 'g1' })).not.toThrow();
    });
  });

  describe('assertVisitorExists / assertVisitorGroupExists', () => {
    it('rejects when the visitor does not resolve within the tenant', async () => {
      mockPrisma.visitor.findFirst.mockResolvedValue(null);
      await expect(service.assertVisitorExists(TENANT_ID, 'visitor-1')).rejects.toThrow(NotFoundException);
    });

    it('rejects when the visitor group does not resolve within the tenant', async () => {
      mockPrisma.visitorGroup.findFirst.mockResolvedValue(null);
      await expect(service.assertVisitorGroupExists(TENANT_ID, 'group-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addActivity', () => {
    const dto = { activityType: 'follow_up', outcome: 'Left a voicemail.' };

    it('validates required custom fields against visitor_activity:{type} before creating the row', async () => {
      mockCustomFieldsService.assertRequiredFieldsProvided.mockRejectedValue(new BadRequestException());

      await expect(service.addActivity(TENANT_ID, { visitorId: 'visitor-1' }, USER_ID, dto as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockCustomFieldsService.assertRequiredFieldsProvided).toHaveBeenCalledWith(
        TENANT_ID,
        'visitor_activity:follow_up',
        undefined,
      );
      expect(mockPrisma.visitorActivity.create).not.toHaveBeenCalled();
    });

    it('creates an activity against a visitor with the acting user as performedByUserId', async () => {
      mockPrisma.visitorActivity.create.mockResolvedValue({ id: 'activity-1' });

      await service.addActivity(TENANT_ID, { visitorId: 'visitor-1' }, USER_ID, dto as any);

      expect(mockPrisma.visitorActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          visitorId: 'visitor-1',
          visitorGroupId: undefined,
          activityType: 'follow_up',
          outcome: 'Left a voicemail.',
          performedByUserId: USER_ID,
        }),
      });
    });

    it('creates an activity against a visitor group', async () => {
      mockPrisma.visitorActivity.create.mockResolvedValue({ id: 'activity-1' });

      await service.addActivity(TENANT_ID, { visitorGroupId: 'group-1' }, USER_ID, dto as any);

      expect(mockPrisma.visitorActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ visitorId: undefined, visitorGroupId: 'group-1' }),
      });
    });

    it('persists provided custom fields against the type-specific entityType after creating the row', async () => {
      mockPrisma.visitorActivity.create.mockResolvedValue({ id: 'activity-1' });

      await service.addActivity(
        TENANT_ID,
        { visitorId: 'visitor-1' },
        USER_ID,
        { ...dto, customFields: { certificate_number: 'BC-01' } } as any,
      );

      expect(mockCustomFieldsService.setValues).toHaveBeenCalledWith(TENANT_ID, 'visitor_activity:follow_up', 'activity-1', {
        certificate_number: 'BC-01',
      });
    });
  });

  describe('listActivities', () => {
    it('returns activities most recent first with their custom fields attached', async () => {
      mockPrisma.visitorActivity.findMany.mockResolvedValue([
        { id: 'activity-2', activityType: 'follow_up' },
        { id: 'activity-1', activityType: 'follow_up' },
      ]);
      mockCustomFieldsService.getValuesForMany.mockResolvedValue({ 'activity-1': { outcome_detail: 'ok' } });

      const result = await service.listActivities(TENANT_ID, { visitorId: 'visitor-1' });

      expect(mockPrisma.visitorActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, visitorId: 'visitor-1' }, orderBy: { activityDate: 'desc' } }),
      );
      expect(result[1].customFields).toEqual({ outcome_detail: 'ok' });
      expect(result[0].customFields).toEqual({});
    });
  });
});
