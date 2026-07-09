import { Injectable, NotFoundException } from '@nestjs/common';
import { MemberActivity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { CreateMemberActivityDto } from './dto/create-member-activity.dto';

export type MemberActivityWithCustomFields = MemberActivity & { customFields: Record<string, unknown> };

/**
 * Logs a tenant-configurable activity (sacraments, trainings, certificates,
 * leadership appointments, one-off volunteer work, ...) against a Member —
 * see docs/member-activities/business-analysis.md. `activityType` composes
 * into Custom Fields the same way VisitorActivitiesService's does
 * (`member_activity:{activityType}`, mirroring `visitor_activity:{activityType}`).
 */
@Injectable()
export class MemberActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customFieldsService: CustomFieldsService,
  ) {}

  entityTypeFor(activityType: string): string {
    return `member_activity:${activityType}`;
  }

  async addActivity(
    tenantId: string,
    memberId: string,
    performedByUserId: string | undefined,
    dto: CreateMemberActivityDto,
  ): Promise<MemberActivityWithCustomFields> {
    await this.assertMemberExists(tenantId, memberId);
    const entityType = this.entityTypeFor(dto.activityType);
    await this.customFieldsService.assertRequiredFieldsProvided(tenantId, entityType, dto.customFields);

    const activity = await this.prisma.memberActivity.create({
      data: {
        tenantId,
        memberId,
        activityType: dto.activityType,
        activityDate: dto.activityDate ? new Date(dto.activityDate) : undefined,
        outcome: dto.outcome,
        notes: dto.notes,
        performedByUserId,
      },
    });

    if (dto.customFields) {
      await this.customFieldsService.setValues(tenantId, entityType, activity.id, dto.customFields);
    }

    return { ...activity, customFields: dto.customFields ?? {} };
  }

  async listActivities(tenantId: string, memberId: string): Promise<MemberActivityWithCustomFields[]> {
    await this.assertMemberExists(tenantId, memberId);
    return this.listActivitiesRaw(tenantId, memberId);
  }

  /** Used by ReportsService's aggregated timeline — skips the existence check since the caller already resolved the member. */
  async listActivitiesRaw(tenantId: string, memberId: string): Promise<MemberActivityWithCustomFields[]> {
    const activities = await this.prisma.memberActivity.findMany({
      where: { tenantId, memberId },
      orderBy: { activityDate: 'desc' },
    });

    const customFieldsByEntityType = new Map<string, Record<string, Record<string, unknown>>>();
    const withCustomFields: MemberActivityWithCustomFields[] = [];
    for (const activity of activities) {
      const entityType = this.entityTypeFor(activity.activityType);
      if (!customFieldsByEntityType.has(entityType)) {
        const idsForType = activities.filter((a) => a.activityType === activity.activityType).map((a) => a.id);
        customFieldsByEntityType.set(
          entityType,
          await this.customFieldsService.getValuesForMany(tenantId, entityType, idsForType),
        );
      }
      const byId = customFieldsByEntityType.get(entityType)!;
      withCustomFields.push({ ...activity, customFields: byId[activity.id] ?? {} });
    }
    return withCustomFields;
  }

  private async assertMemberExists(tenantId: string, memberId: string): Promise<void> {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, tenantId, deletedAt: null } });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
  }
}
