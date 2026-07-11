import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomFieldDefinition } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomFieldDefinitionDto } from './dto/create-custom-field-definition.dto';
import { UpdateCustomFieldDefinitionDto } from './dto/update-custom-field-definition.dto';

/**
 * Manages the *definitions* (which fields exist) — see
 * docs/custom-fields/business-analysis.md. Mirrors the Configuration
 * Engine's ConfigItem API shape exactly (create/list/get/update/deactivate/
 * reactivate, no hard delete) since this is conceptually a sibling of it:
 * both are the mechanism a tenant uses to shape the platform to their own
 * church without a code change.
 */
@Injectable()
export class CustomFieldDefinitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCustomFieldDefinitionDto): Promise<CustomFieldDefinition> {
    this.assertOptionsValidForType(dto.fieldType, dto.options);
    this.assertLookupEntityTypeValidForType(dto.fieldType, dto.lookupEntityType);

    const existing = await this.prisma.customFieldDefinition.findUnique({
      where: { tenantId_entityType_fieldKey: { tenantId, entityType: dto.entityType, fieldKey: dto.fieldKey } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CUSTOM_FIELD_KEY_TAKEN',
        message: `"${dto.fieldKey}" already exists for entity type "${dto.entityType}".`,
      });
    }

    return this.prisma.customFieldDefinition.create({
      data: {
        tenantId,
        entityType: dto.entityType,
        fieldKey: dto.fieldKey,
        label: dto.label,
        fieldType: dto.fieldType,
        options: dto.options as any,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? 0,
        section: dto.section,
        visibleToRoleNames: dto.visibleToRoleNames ?? [],
        validationRules: dto.validationRules as any,
        lookupEntityType: dto.lookupEntityType,
      },
    });
  }

  async findAll(tenantId: string, entityType?: string, includeInactive = false): Promise<CustomFieldDefinition[]> {
    return this.prisma.customFieldDefinition.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(entityType ? { entityType } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string): Promise<CustomFieldDefinition> {
    const definition = await this.prisma.customFieldDefinition.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!definition) {
      throw new NotFoundException({ code: 'CUSTOM_FIELD_NOT_FOUND', message: 'Custom field definition not found.' });
    }
    return definition;
  }

  async update(tenantId: string, id: string, dto: UpdateCustomFieldDefinitionDto): Promise<CustomFieldDefinition> {
    const existing = await this.findOne(tenantId, id);
    if (dto.options !== undefined) {
      this.assertOptionsValidForType(existing.fieldType as any, dto.options);
    }

    return this.prisma.customFieldDefinition.update({
      where: { id },
      data: {
        label: dto.label,
        options: dto.options as any,
        isRequired: dto.isRequired,
        sortOrder: dto.sortOrder,
        section: dto.section,
        visibleToRoleNames: dto.visibleToRoleNames,
        validationRules: dto.validationRules as any,
        isActive: dto.isActive,
      },
    });
  }

  /** Soft toggle only, mirroring ConfigItem — existing CustomFieldValue rows for a retired field remain valid history. */
  async deactivate(tenantId: string, id: string): Promise<CustomFieldDefinition> {
    await this.findOne(tenantId, id);
    return this.prisma.customFieldDefinition.update({ where: { id }, data: { isActive: false } });
  }

  async reactivate(tenantId: string, id: string): Promise<CustomFieldDefinition> {
    await this.findOne(tenantId, id);
    return this.prisma.customFieldDefinition.update({ where: { id }, data: { isActive: true } });
  }

  /**
   * Soft-delete, distinct from `deactivate` — deactivate just hides a field
   * from forms while keeping it fully visible/manageable in the Custom
   * Fields admin list; delete removes it from that list too, recoverable
   * only via the Trash view (TrashService).
   */
  async softDelete(tenantId: string, id: string): Promise<CustomFieldDefinition> {
    await this.findOne(tenantId, id);
    return this.prisma.customFieldDefinition.update({ where: { id, tenantId }, data: { deletedAt: new Date(), isActive: false } });
  }

  private assertOptionsValidForType(fieldType: string, options: { key: string; label: string }[] | undefined): void {
    if (['select', 'radio', 'multiselect'].includes(fieldType) && (!options || options.length === 0)) {
      throw new BadRequestException({
        code: 'CUSTOM_FIELD_OPTIONS_REQUIRED',
        message: `A "${fieldType}" field requires at least one option.`,
      });
    }
  }

  private assertLookupEntityTypeValidForType(fieldType: string, lookupEntityType: string | undefined): void {
    if (fieldType === 'lookup' && !lookupEntityType) {
      throw new BadRequestException({
        code: 'CUSTOM_FIELD_LOOKUP_ENTITY_TYPE_REQUIRED',
        message: 'A "lookup" field requires lookupEntityType (which entity it points to).',
      });
    }
  }
}
