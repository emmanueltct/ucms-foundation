import { BadRequestException, Injectable } from '@nestjs/common';
import { CustomFieldDefinition } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The reusable half of the Custom Fields module — this is what other
 * modules (Members, and eventually Finance/Attendance/Ministries) inject to
 * read/write a specific record's custom field *values* against whatever
 * fields this tenant has defined for that `entityType`. See
 * docs/custom-fields/business-analysis.md for the full pattern and which
 * entities are wired up today.
 */
@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefinitions(tenantId: string, entityType: string): Promise<CustomFieldDefinition[]> {
    return this.prisma.customFieldDefinition.findMany({
      where: { tenantId, entityType, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async getValues(tenantId: string, entityType: string, entityId: string): Promise<Record<string, unknown>> {
    const rows = await this.prisma.customFieldValue.findMany({ where: { tenantId, entityType, entityId } });
    return Object.fromEntries(rows.map((r) => [r.fieldKey, r.value]));
  }

  /** Batched variant for list endpoints, avoiding one query per row. */
  async getValuesForMany(
    tenantId: string,
    entityType: string,
    entityIds: string[],
  ): Promise<Record<string, Record<string, unknown>>> {
    if (entityIds.length === 0) return {};
    const rows = await this.prisma.customFieldValue.findMany({
      where: { tenantId, entityType, entityId: { in: entityIds } },
    });
    const grouped: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      grouped[row.entityId] ??= {};
      grouped[row.entityId][row.fieldKey] = row.value;
    }
    return grouped;
  }

  /**
   * Validates and upserts whichever keys are present in `values`. Keys
   * omitted from `values` are left untouched — this is a partial update,
   * the same semantics `PATCH` has everywhere else in the API.
   */
  async setValues(tenantId: string, entityType: string, entityId: string, values: Record<string, unknown>): Promise<void> {
    const providedKeys = Object.keys(values);
    if (providedKeys.length === 0) return;

    const definitions = await this.getDefinitions(tenantId, entityType);
    const byKey = new Map(definitions.map((d) => [d.fieldKey, d]));

    for (const key of providedKeys) {
      const definition = byKey.get(key);
      if (!definition) {
        throw new BadRequestException({
          code: 'CUSTOM_FIELD_UNKNOWN',
          message: `"${key}" is not a defined custom field for "${entityType}".`,
        });
      }
      this.assertValidValue(definition, values[key]);
    }

    await this.prisma.$transaction(
      providedKeys.map((key) =>
        this.prisma.customFieldValue.upsert({
          where: { tenantId_entityType_entityId_fieldKey: { tenantId, entityType, entityId, fieldKey: key } },
          create: { tenantId, entityType, entityId, fieldKey: key, value: values[key] as any },
          update: { value: values[key] as any },
        }),
      ),
    );
  }

  /**
   * Called by a creating module *before* persisting the parent record, so a
   * missing required custom field fails loudly before any row is written —
   * the same "fail before create" shape `assertBranchExists` etc. already
   * use elsewhere.
   */
  async assertRequiredFieldsProvided(
    tenantId: string,
    entityType: string,
    values: Record<string, unknown> | undefined,
  ): Promise<void> {
    const definitions = await this.getDefinitions(tenantId, entityType);
    const missing = definitions.filter((d) => {
      if (!d.isRequired) return false;
      const provided = values?.[d.fieldKey];
      return provided === undefined || provided === null || provided === '';
    });
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'CUSTOM_FIELD_REQUIRED',
        message: `Missing required custom field(s): ${missing.map((d) => d.label).join(', ')}`,
      });
    }
  }

  private assertValidValue(definition: CustomFieldDefinition, value: unknown): void {
    if (value === null || value === undefined) return; // clearing an optional field is fine

    switch (definition.fieldType) {
      case 'text':
        if (typeof value !== 'string') this.throwInvalidType(definition, 'a string');
        break;
      case 'number':
        if (typeof value !== 'number') this.throwInvalidType(definition, 'a number');
        break;
      case 'boolean':
        if (typeof value !== 'boolean') this.throwInvalidType(definition, 'a boolean');
        break;
      case 'date':
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) this.throwInvalidType(definition, 'an ISO date string');
        break;
      case 'select': {
        const options = (definition.options as { key: string }[] | null) ?? [];
        if (typeof value !== 'string' || !options.some((o) => o.key === value)) {
          throw new BadRequestException({
            code: 'CUSTOM_FIELD_INVALID_VALUE',
            message: `"${definition.label}" must be one of: ${options.map((o) => o.key).join(', ')}`,
          });
        }
        break;
      }
      case 'file': {
        const fileValue = value as { key?: unknown; filename?: unknown } | null;
        if (
          typeof fileValue !== 'object' ||
          fileValue === null ||
          typeof fileValue.key !== 'string' ||
          typeof fileValue.filename !== 'string'
        ) {
          this.throwInvalidType(definition, 'an uploaded file reference ({ key, filename })');
        }
        break;
      }
    }
  }

  private throwInvalidType(definition: CustomFieldDefinition, expected: string): never {
    throw new BadRequestException({
      code: 'CUSTOM_FIELD_INVALID_VALUE',
      message: `"${definition.label}" must be ${expected}.`,
    });
  }
}
