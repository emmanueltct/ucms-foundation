import { Test } from '@nestjs/testing';
import { FormAssignmentNotifier } from '../src/common/form-assignment-notifier/form-assignment-notifier.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EligibilityResolverService } from '../src/common/eligibility/eligibility-resolver.service';
import { NotificationsService } from '../src/communication/notifications.service';

describe('FormAssignmentNotifier', () => {
  let service: FormAssignmentNotifier;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = { dynamicModuleDefinition: { findFirst: jest.fn() } };
  const mockEligibilityResolver = { resolveUsersEligibleForScope: jest.fn() };
  const mockNotifications = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        FormAssignmentNotifier,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EligibilityResolverService, useValue: mockEligibilityResolver },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = moduleRef.get(FormAssignmentNotifier);
  });

  it('does nothing for a non-form resourceType', async () => {
    await service.notifyIfForm(TENANT_ID, { resourceType: 'module', resourceKey: 'mod-1', scopeEntityType: 'branch', scopeEntityId: 'branch-1' } as any);

    expect(mockEligibilityResolver.resolveUsersEligibleForScope).not.toHaveBeenCalled();
    expect(mockNotifications.create).not.toHaveBeenCalled();
  });

  describe('for resourceType dynamic_module_definition', () => {
    const assignment = { resourceType: 'dynamic_module_definition', resourceKey: 'form-1', scopeEntityType: 'branch', scopeEntityId: 'branch-1', dueAt: null } as any;

    it('skips notification entirely when the form definition cannot be resolved', async () => {
      mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue(null);

      await service.notifyIfForm(TENANT_ID, assignment);

      expect(mockEligibilityResolver.resolveUsersEligibleForScope).not.toHaveBeenCalled();
    });

    it('notifies every eligible user for the scope', async () => {
      mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({ id: 'form-1', label: 'ICT Equipment Audit' });
      mockEligibilityResolver.resolveUsersEligibleForScope.mockResolvedValue(['user-1', 'user-2']);

      await service.notifyIfForm(TENANT_ID, assignment);

      expect(mockEligibilityResolver.resolveUsersEligibleForScope).toHaveBeenCalledWith(TENANT_ID, 'branch', 'branch-1');
      expect(mockNotifications.create).toHaveBeenCalledTimes(2);
      expect(mockNotifications.create).toHaveBeenCalledWith(TENANT_ID, undefined, expect.objectContaining({
        channel: 'email',
        userId: 'user-1',
        subject: expect.stringContaining('ICT Equipment Audit'),
      }));
    });

    it('includes the due date in the notification body when dueAt is set', async () => {
      mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({ id: 'form-1', label: 'ICT Equipment Audit' });
      mockEligibilityResolver.resolveUsersEligibleForScope.mockResolvedValue(['user-1']);

      await service.notifyIfForm(TENANT_ID, { ...assignment, dueAt: new Date('2026-08-01T00:00:00.000Z') });

      expect(mockNotifications.create).toHaveBeenCalledWith(TENANT_ID, undefined, expect.objectContaining({
        body: expect.stringContaining('2026-08-01'),
      }));
    });

    it('omits the due-date suffix when no dueAt is set', async () => {
      mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({ id: 'form-1', label: 'ICT Equipment Audit' });
      mockEligibilityResolver.resolveUsersEligibleForScope.mockResolvedValue(['user-1']);

      await service.notifyIfForm(TENANT_ID, assignment);

      expect(mockNotifications.create).toHaveBeenCalledWith(TENANT_ID, undefined, expect.objectContaining({
        body: expect.not.stringContaining('due'),
      }));
    });

    it('never lets one user\'s notification failure stop the others from being notified', async () => {
      mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({ id: 'form-1', label: 'ICT Equipment Audit' });
      mockEligibilityResolver.resolveUsersEligibleForScope.mockResolvedValue(['user-1', 'user-2']);
      mockNotifications.create.mockRejectedValueOnce(new Error('queue down')).mockResolvedValueOnce({ id: 'notif-1' });

      await expect(service.notifyIfForm(TENANT_ID, assignment)).resolves.toBeUndefined();
      expect(mockNotifications.create).toHaveBeenCalledTimes(2);
    });
  });
});
