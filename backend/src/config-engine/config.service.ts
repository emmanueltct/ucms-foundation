import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConfigItemDto } from './dto/create-config-item.dto';
import { UpdateConfigItemDto } from './dto/update-config-item.dto';

/**
 * The generic Configuration Engine described in business-analysis.md.
 *
 * Every future module (Finance's contribution types, Ministry's ministry
 * list, Membership's categories, Events' ceremony names, ...) reuses THIS
 * service rather than inventing its own settings table. The `namespace`
 * field is the only thing that varies; `value` is an opaque JSON blob whose
 * shape is defined and validated by the consuming module, not here.
 */
@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateConfigItemDto) {
    const existing = await this.prisma.configItem.findUnique({
      where: { tenantId_namespace_key: { tenantId, namespace: dto.namespace, key: dto.key } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONFIG_KEY_TAKEN',
        message: `"${dto.key}" already exists in namespace "${dto.namespace}".`,
      });
    }

    return this.prisma.configItem.create({
      data: {
        tenantId,
        namespace: dto.namespace,
        key: dto.key,
        label: dto.label,
        value: dto.value as any,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /** List every item in a namespace, e.g. all "contribution_type" items for a tenant. */
  async findByNamespace(tenantId: string, namespace: string, includeInactive = false) {
    return this.prisma.configItem.findMany({
      where: { tenantId, namespace, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const item = await this.prisma.configItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException({ code: 'CONFIG_ITEM_NOT_FOUND', message: 'Configuration item not found.' });
    return item;
  }

  async update(tenantId: string, id: string, dto: UpdateConfigItemDto) {
    await this.findOne(tenantId, id);
    return this.prisma.configItem.update({
      where: { id },
      data: { ...dto, value: dto.value as any },
    });
  }

  /** Soft toggle only — never hard-delete a config item that other records may reference (FR-4.4). */
  async deactivate(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.configItem.update({ where: { id }, data: { isActive: false } });
  }

  async reactivate(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.configItem.update({ where: { id }, data: { isActive: true } });
  }

  // ------------------------------------------------------------------
  // Feature toggles
  // ------------------------------------------------------------------

  async listFeatureToggles(tenantId: string) {
    return this.prisma.featureToggle.findMany({ where: { tenantId }, orderBy: { featureKey: 'asc' } });
  }

  async setFeatureToggle(tenantId: string, featureKey: string, isEnabled: boolean) {
    return this.prisma.featureToggle.upsert({
      where: { tenantId_featureKey: { tenantId, featureKey } },
      create: { tenantId, featureKey, isEnabled },
      update: { isEnabled },
    });
  }

  async isFeatureEnabled(tenantId: string, featureKey: string): Promise<boolean> {
    const toggle = await this.prisma.featureToggle.findUnique({
      where: { tenantId_featureKey: { tenantId, featureKey } },
    });
    return toggle?.isEnabled ?? false;
  }
}
