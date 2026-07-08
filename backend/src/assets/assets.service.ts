import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Asset, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { StorageService } from '../storage/storage.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetQueryDto } from './dto/asset-query.dto';

export type AssetWithCustomFields = Asset & { customFields: Record<string, unknown> };

export interface UploadedFileValue {
  key: string;
  filename: string;
  size: number;
  contentType: string;
}

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * Assets — see docs/asset-management/business-analysis.md. Unlike every
 * prior module's Custom Fields integration, the entityType handed to
 * CustomFieldsService isn't a fixed constant: it's `asset:{assetCategory}`,
 * computed per record, so each tenant-defined asset category gets its own
 * field set (a vehicle's mileage, a building's floor count, ...) from the
 * same underlying mechanism Member & Family Management already uses.
 */
@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customFieldsService: CustomFieldsService,
    private readonly storageService: StorageService,
  ) {}

  entityTypeFor(assetCategory: string): string {
    return `asset:${assetCategory}`;
  }

  async create(tenantId: string, dto: CreateAssetDto): Promise<AssetWithCustomFields> {
    if (dto.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }
    if (dto.assetTag) {
      await this.assertAssetTagFree(tenantId, dto.assetTag);
    }
    const entityType = this.entityTypeFor(dto.assetCategory);
    await this.customFieldsService.assertRequiredFieldsProvided(tenantId, entityType, dto.customFields);

    const hasMonetaryValue = dto.acquisitionCost !== undefined || dto.currentValue !== undefined;
    const currency = hasMonetaryValue ? dto.currency ?? (await this.tenantCurrency(tenantId)) : dto.currency;

    const asset = await this.prisma.asset.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        name: dto.name,
        assetCategory: dto.assetCategory,
        assetTag: dto.assetTag,
        condition: dto.condition,
        status: dto.status ?? 'in_use',
        location: dto.location,
        acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : undefined,
        acquisitionCost: dto.acquisitionCost,
        currentValue: dto.currentValue,
        currency,
        notes: dto.notes,
      },
    });

    if (dto.customFields) {
      await this.customFieldsService.setValues(tenantId, entityType, asset.id, dto.customFields);
    }

    return { ...asset, customFields: dto.customFields ?? {} };
  }

  async findAll(tenantId: string, query: AssetQueryDto) {
    const where = this.buildWhere(tenantId, query);

    const [items, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { createdAt: 'desc' },
      }),
      this.prisma.asset.count({ where }),
    ]);

    const customFieldsByEntityType = new Map<string, Record<string, Record<string, unknown>>>();
    const itemsWithCustomFields: AssetWithCustomFields[] = [];
    for (const item of items) {
      const entityType = this.entityTypeFor(item.assetCategory);
      if (!customFieldsByEntityType.has(entityType)) {
        const idsForCategory = items.filter((i) => i.assetCategory === item.assetCategory).map((i) => i.id);
        customFieldsByEntityType.set(
          entityType,
          await this.customFieldsService.getValuesForMany(tenantId, entityType, idsForCategory),
        );
      }
      const byId = customFieldsByEntityType.get(entityType)!;
      itemsWithCustomFields.push({ ...item, customFields: byId[item.id] ?? {} });
    }

    return {
      items: itemsWithCustomFields,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async findOne(tenantId: string, id: string): Promise<AssetWithCustomFields> {
    const asset = await this.findOneRaw(tenantId, id);
    const customFields = await this.customFieldsService.getValues(tenantId, this.entityTypeFor(asset.assetCategory), id);
    return { ...asset, customFields };
  }

  async update(tenantId: string, id: string, dto: UpdateAssetDto): Promise<AssetWithCustomFields> {
    const existing = await this.findOneRaw(tenantId, id);

    if (dto.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }
    if (dto.assetTag && dto.assetTag !== existing.assetTag) {
      await this.assertAssetTagFree(tenantId, dto.assetTag);
    }

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        name: dto.name,
        assetTag: dto.assetTag,
        condition: dto.condition,
        status: dto.status,
        location: dto.location,
        acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : undefined,
        acquisitionCost: dto.acquisitionCost,
        currentValue: dto.currentValue,
        currency: dto.currency,
        notes: dto.notes,
      },
    });

    const entityType = this.entityTypeFor(existing.assetCategory);
    if (dto.customFields) {
      await this.customFieldsService.setValues(tenantId, entityType, id, dto.customFields);
    }
    const customFields = await this.customFieldsService.getValues(tenantId, entityType, id);

    return { ...updated, customFields };
  }

  async softDelete(tenantId: string, id: string): Promise<Asset> {
    await this.findOneRaw(tenantId, id);
    return this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Uploads a document against a `file`-typed custom field for this asset's category. */
  async uploadDocument(
    tenantId: string,
    assetId: string,
    fieldKey: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
  ): Promise<UploadedFileValue> {
    if (!file) {
      throw new BadRequestException({ code: 'ASSET_DOCUMENT_FILE_REQUIRED', message: 'A file is required.' });
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'ASSET_DOCUMENT_TYPE_UNSUPPORTED',
        message: 'Only PDF, JPEG, PNG, DOC, or DOCX files are accepted.',
      });
    }

    const asset = await this.findOneRaw(tenantId, assetId);
    const entityType = this.entityTypeFor(asset.assetCategory);
    const definitions = await this.customFieldsService.getDefinitions(tenantId, entityType);
    const definition = definitions.find((d) => d.fieldKey === fieldKey);
    if (!definition || definition.fieldType !== 'file') {
      throw new BadRequestException({
        code: 'ASSET_DOCUMENT_FIELD_INVALID',
        message: `"${fieldKey}" is not a file field defined for the "${asset.assetCategory}" category.`,
      });
    }

    const key = `tenants/${tenantId}/assets/${assetId}/${fieldKey}/${Date.now()}-${file.originalname}`;
    await this.storageService.uploadObject(key, file.buffer, file.mimetype);

    const value: UploadedFileValue = {
      key,
      filename: file.originalname,
      size: file.size,
      contentType: file.mimetype,
    };
    await this.customFieldsService.setValues(tenantId, entityType, assetId, { [fieldKey]: value });
    return value;
  }

  async getDocumentDownloadUrl(tenantId: string, assetId: string, fieldKey: string): Promise<{ url: string; filename: string }> {
    const asset = await this.findOneRaw(tenantId, assetId);
    const entityType = this.entityTypeFor(asset.assetCategory);
    const values = await this.customFieldsService.getValues(tenantId, entityType, assetId);
    const value = values[fieldKey] as UploadedFileValue | undefined;
    if (!value?.key) {
      throw new NotFoundException({ code: 'ASSET_DOCUMENT_NOT_FOUND', message: 'No file has been uploaded for this field.' });
    }
    const url = await this.storageService.getSignedDownloadUrl(value.key);
    return { url, filename: value.filename };
  }

  private async findOneRaw(tenantId: string, id: string): Promise<Asset> {
    const asset = await this.prisma.asset.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!asset) throw new NotFoundException({ code: 'ASSET_NOT_FOUND', message: 'Asset not found.' });
    return asset;
  }

  private buildWhere(tenantId: string, query: AssetQueryDto): Prisma.AssetWhereInput {
    return {
      tenantId,
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.assetCategory ? { assetCategory: query.assetCategory } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { assetTag: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  private async assertBranchExists(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
  }

  private async assertAssetTagFree(tenantId: string, assetTag: string): Promise<void> {
    const existing = await this.prisma.asset.findFirst({ where: { tenantId, assetTag } });
    if (existing) {
      throw new ConflictException({ code: 'ASSET_TAG_TAKEN', message: `Asset tag "${assetTag}" is already in use.` });
    }
  }

  private async tenantCurrency(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
    return tenant?.currency ?? 'RWF';
  }
}
