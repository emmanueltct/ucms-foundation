import { Injectable } from '@nestjs/common';
import { ResourceAssignment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EligibilityResolverService } from '../eligibility/eligibility-resolver.service';
import { NotificationsService } from '../../communication/notifications.service';
import { FORM_RESOURCE_TYPE } from './form-resource-type.constant';

/**
 * §14: when a form/report is assigned to a scope, every currently-eligible
 * user (the reverse of §13's resolver) is notified. Shared by both
 * `ResourceAssignmentsService.create` (the generic `/resource-assignments`
 * endpoint) and `BranchesService.assignResource` (the branch-specific
 * convenience endpoint) — extracted here rather than duplicated in both,
 * and its own tiny module so neither of those two modules needs to depend
 * on the other (both only need to depend on this one, and on
 * `EligibilityResolverModule`/`CommunicationModule` transitively).
 */
@Injectable()
export class FormAssignmentNotifier {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibilityResolver: EligibilityResolverService,
    private readonly notifications: NotificationsService,
  ) {}

  /** No-op for any resourceType other than `FORM_RESOURCE_TYPE` — safe to call unconditionally after any `ResourceAssignment` create. */
  async notifyIfForm(tenantId: string, assignment: ResourceAssignment): Promise<void> {
    if (assignment.resourceType !== FORM_RESOURCE_TYPE) return;

    const definition = await this.prisma.dynamicModuleDefinition.findFirst({ where: { id: assignment.resourceKey, tenantId } });
    if (!definition) return;

    const userIds = await this.eligibilityResolver.resolveUsersEligibleForScope(tenantId, assignment.scopeEntityType, assignment.scopeEntityId);
    const dueSuffix = assignment.dueAt ? ` — due ${assignment.dueAt.toISOString().slice(0, 10)}` : '';

    for (const userId of userIds) {
      try {
        await this.notifications.create(tenantId, undefined, {
          channel: 'email',
          userId,
          subject: `New form available: ${definition.label}`,
          body: `"${definition.label}" has been assigned to you${dueSuffix}. Please complete it from your dashboard.`,
        });
      } catch {
        // A notification failure must never block the assignment itself — it already succeeded and is the source of truth.
      }
    }
  }
}
