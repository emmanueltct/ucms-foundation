import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AssetsService } from '../src/assets/assets.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CustomFieldsService } from '../src/custom-fields/custom-fields.service';
import { StorageService } from '../src/storage/storage.service';

describe('AssetsService', () => {
  let service: AssetsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    asset: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
    branch: { findFirst: jest.fn() },
    tenant: { findUnique: jest.fn() },
  };

  const mockCustomFieldsService = {
    assertRequiredFieldsProvided: jest.fn(),
    setValues: jest.fn(),
    getValues: jest.fn(),
    getValuesForMany: jest.fn(),
    getDefinitions: jest.fn(),
  };

  const mockStorageService = {
    uploadObject: jest.fn(),
    getSignedDownloadUrl: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCustomFieldsService.assertRequiredFieldsProvided.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CustomFieldsService, useValue: mockCustomFieldsService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();
    service = moduleRef.get(AssetsService);
  });

  describe('entityTypeFor', () => {
    it('composes the Custom Fields entityType from the asset category', () => {
      expect(service.entityTypeFor('vehicle')).toBe('asset:vehicle');
    });
  });

  describe('create', () => {
    const baseDto = { name: 'Youth Van', assetCategory: 'vehicle' };

    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.create(TENANT_ID, { ...baseDto, branchId: 'branch-1' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects when assetTag is already taken within the tenant', async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(TENANT_ID, { ...baseDto, assetTag: 'VEH-0001' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('validates required custom fields against asset:{category} before creating the row', async () => {
      mockPrisma.asset.findFirst.mockResolvedValue(null);
      mockCustomFieldsService.assertRequiredFieldsProvided.mockRejectedValue(new BadRequestException());
      mockPrisma.asset.create.mockResolvedValue({ id: 'asset-1' });

      await expect(service.create(TENANT_ID, baseDto as any)).rejects.toThrow(BadRequestException);
      expect(mockCustomFieldsService.assertRequiredFieldsProvided).toHaveBeenCalledWith(
        TENANT_ID,
        'asset:vehicle',
        undefined,
      );
      expect(mockPrisma.asset.create).not.toHaveBeenCalled();
    });

    it('defaults currency from the tenant only when a monetary value is provided', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ currency: 'USD' });
      mockPrisma.asset.create.mockResolvedValue({ id: 'asset-1' });

      await service.create(TENANT_ID, { ...baseDto, acquisitionCost: 5000 } as any);

      expect(mockPrisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currency: 'USD' }) }),
      );
    });

    it('leaves currency unset when no monetary value is provided', async () => {
      mockPrisma.asset.create.mockResolvedValue({ id: 'asset-1' });

      await service.create(TENANT_ID, baseDto as any);

      expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currency: undefined }) }),
      );
    });

    it('persists provided custom fields against the category-specific entityType after creating the row', async () => {
      mockPrisma.asset.create.mockResolvedValue({ id: 'asset-1' });

      await service.create(TENANT_ID, { ...baseDto, customFields: { mileage_km: 100 } } as any);

      expect(mockCustomFieldsService.setValues).toHaveBeenCalledWith(TENANT_ID, 'asset:vehicle', 'asset-1', {
        mileage_km: 100,
      });
    });
  });

  describe('uploadDocument', () => {
    const file = { buffer: Buffer.from('x'), originalname: 'insurance.pdf', mimetype: 'application/pdf', size: 123 };

    it('rejects when no file is provided', async () => {
      await expect(service.uploadDocument(TENANT_ID, 'asset-1', 'insurance_document', undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an unsupported file type', async () => {
      await expect(
        service.uploadDocument(TENANT_ID, 'asset-1', 'insurance_document', { ...file, mimetype: 'application/zip' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when fieldKey does not name an active file-type field for this asset\'s category', async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({ id: 'asset-1', assetCategory: 'vehicle' });
      mockCustomFieldsService.getDefinitions.mockResolvedValue([
        { fieldKey: 'mileage_km', fieldType: 'number' },
      ]);

      await expect(service.uploadDocument(TENANT_ID, 'asset-1', 'mileage_km', file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('uploads to storage and persists the resulting reference as the custom field value', async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({ id: 'asset-1', assetCategory: 'vehicle' });
      mockCustomFieldsService.getDefinitions.mockResolvedValue([
        { fieldKey: 'insurance_document', fieldType: 'file' },
      ]);
      mockStorageService.uploadObject.mockResolvedValue({ key: 'tenants/t1/assets/asset-1/insurance_document/x.pdf' });

      const result = await service.uploadDocument(TENANT_ID, 'asset-1', 'insurance_document', file);

      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        expect.stringContaining('tenants/tenant-1/assets/asset-1/insurance_document/'),
        file.buffer,
        'application/pdf',
      );
      expect(mockCustomFieldsService.setValues).toHaveBeenCalledWith(TENANT_ID, 'asset:vehicle', 'asset-1', {
        insurance_document: expect.objectContaining({ filename: 'insurance.pdf', size: 123, contentType: 'application/pdf' }),
      });
      expect(result.filename).toBe('insurance.pdf');
    });
  });

  describe('getDocumentDownloadUrl', () => {
    it('rejects when no file has been uploaded for that field yet', async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({ id: 'asset-1', assetCategory: 'vehicle' });
      mockCustomFieldsService.getValues.mockResolvedValue({});

      await expect(service.getDocumentDownloadUrl(TENANT_ID, 'asset-1', 'insurance_document')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns a signed URL when a file reference exists', async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({ id: 'asset-1', assetCategory: 'vehicle' });
      mockCustomFieldsService.getValues.mockResolvedValue({
        insurance_document: { key: 'tenants/t1/assets/asset-1/insurance_document/x.pdf', filename: 'insurance.pdf' },
      });
      mockStorageService.getSignedDownloadUrl.mockResolvedValue('https://signed.example/x.pdf');

      const result = await service.getDocumentDownloadUrl(TENANT_ID, 'asset-1', 'insurance_document');

      expect(result).toEqual({ url: 'https://signed.example/x.pdf', filename: 'insurance.pdf' });
    });
  });
});
