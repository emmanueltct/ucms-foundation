import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VisitorActivity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { CreateVisitorActivityDto } from './dto/create-visitor-activity.dto';

export type VisitorActivityWithCustomFields = VisitorActivity & { customFields: Record<string, unknown> };

/**
 * Shared by both Visitors and VisitorGroups — a logged activity always
 * targets exactly one of the two (never both, never neither), so both
 * controllers call this one service rather than duplicating the same
 * create/list/customFields logic. `activityType` composes into the
 * `visitor_activity:{activityType}` entityType the same way Assets composes
 * `asset:{assetCategory}` — see docs/visitor-management/business-analysis.md.
 */
@Injectable()
export class VisitorActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customFieldsService: CustomFieldsService,
  ) {}

  entityTypeFor(activityType: string): string {
    return `visitor_activity:${activityType}`;
  }

  async addActivity(
    tenantId: string,
    target: { visitorId?: string; visitorGroupId?: string },
    performedByUserId: string | undefined,
    dto: CreateVisitorActivityDto,
  ): Promise<VisitorActivityWithCustomFields> {
    const entityType = this.entityTypeFor(dto.activityType);
    await this.customFieldsService.assertRequiredFieldsProvided(tenantId, entityType, dto.customFields);

    const activity = await this.prisma.visitorActivity.create({
      data: {
        tenantId,
        visitorId: target.visitorId,
        visitorGroupId: target.visitorGroupId,
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

  async listActivities(
    tenantId: string,
    target: { visitorId?: string; visitorGroupId?: string },
  ): Promise<VisitorActivityWithCustomFields[]> {
    const activities = await this.prisma.visitorActivity.findMany({
      where: { tenantId, ...target },
      orderBy: { activityDate: 'desc' },
    });

    const customFieldsByEntityType = new Map<string, Record<string, Record<string, unknown>>>();
    const withCustomFields: VisitorActivityWithCustomFields[] = [];
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

  /** Guards against a caller passing neither or both of visitorId/visitorGroupId. */
  assertExactlyOneTarget(target: { visitorId?: string; visitorGroupId?: string }): void {
    const targetCount = [target.visitorId, target.visitorGroupId].filter(Boolean).length;
    if (targetCount !== 1) {
      throw new BadRequestException({
        code: 'VISITOR_ACTIVITY_TARGET_INVALID',
        message: 'A visitor activity must target exactly one visitor or visitor group.',
      });
    }
  }

  async assertVisitorExists(tenantId: string, visitorId: string): Promise<void> {
    const visitor = await this.prisma.visitor.findFirst({ where: { id: visitorId, tenantId, deletedAt: null } });
    if (!visitor) throw new NotFoundException({ code: 'VISITOR_NOT_FOUND', message: 'Visitor not found.' });
  }

  async assertVisitorGroupExists(tenantId: string, visitorGroupId: string): Promise<void> {
    const group = await this.prisma.visitorGroup.findFirst({ where: { id: visitorGroupId, tenantId, deletedAt: null } });
    if (!group) throw new NotFoundException({ code: 'VISITOR_GROUP_NOT_FOUND', message: 'Visitor group not found.' });
  }
}
