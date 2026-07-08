import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from '../src/documents/documents.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';

describe('DocumentsService', () => {
  let service: DocumentsService;

  const TENANT_ID = 'tenant-1';
  const USER_ID = 'user-1';

  const mockPrisma = {
    document: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
    branch: { findFirst: jest.fn() },
  };

  const mockStorageService = {
    uploadObject: jest.fn(),
    getSignedDownloadUrl: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();
    service = moduleRef.get(DocumentsService);
  });

  const file = { buffer: Buffer.from('x'), originalname: 'minutes.pdf', mimetype: 'application/pdf', size: 1024 };
  const baseDto = { title: 'Board Minutes', category: 'minutes' };

  describe('create', () => {
    it('rejects when no file is provided', async () => {
      await expect(service.create(TENANT_ID, USER_ID, baseDto as any, undefined)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.document.create).not.toHaveBeenCalled();
    });

    it('rejects an unsupported file type', async () => {
      await expect(
        service.create(TENANT_ID, USER_ID, baseDto as any, { ...file, mimetype: 'application/zip' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a file over the size cap', async () => {
      await expect(
        service.create(TENANT_ID, USER_ID, baseDto as any, { ...file, size: 11 * 1024 * 1024 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, USER_ID, { ...baseDto, branchId: 'branch-1' } as any, file),
      ).rejects.toThrow(NotFoundException);
      expect(mockStorageService.uploadObject).not.toHaveBeenCalled();
    });

    it('uploads to storage and creates the row with a pre-generated id, keyed by that id', async () => {
      mockPrisma.document.create.mockResolvedValue({ id: 'doc-1' });

      await service.create(TENANT_ID, USER_ID, baseDto as any, file);

      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        expect.stringContaining(`tenants/${TENANT_ID}/documents/`),
        file.buffer,
        'application/pdf',
      );
      expect(mockPrisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: expect.any(String),
            tenantId: TENANT_ID,
            title: 'Board Minutes',
            category: 'minutes',
            fileName: 'minutes.pdf',
            fileSize: 1024,
            contentType: 'application/pdf',
            uploadedByUserId: USER_ID,
          }),
        }),
      );
      const [uploadedKey] = mockStorageService.uploadObject.mock.calls[0];
      const [createCall] = mockPrisma.document.create.mock.calls[0];
      expect(uploadedKey).toContain(createCall.data.id);
    });
  });

  describe('update', () => {
    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'doc-1' });
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, 'doc-1', { branchId: 'branch-1' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates metadata fields only', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'doc-1' });
      mockPrisma.document.update.mockResolvedValue({ id: 'doc-1', title: 'Updated Title' });

      await service.update(TENANT_ID, 'doc-1', { title: 'Updated Title' } as any);

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { branchId: undefined, title: 'Updated Title', description: undefined, category: undefined },
      });
    });
  });

  describe('replaceFile', () => {
    it('rejects when no file is provided', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'doc-1' });

      await expect(service.replaceFile(TENANT_ID, 'doc-1', undefined)).rejects.toThrow(BadRequestException);
    });

    it('uploads a new object and updates the file fields', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'doc-1' });
      mockPrisma.document.update.mockResolvedValue({ id: 'doc-1' });

      await service.replaceFile(TENANT_ID, 'doc-1', { ...file, originalname: 'minutes-v2.pdf' });

      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        expect.stringContaining('tenants/tenant-1/documents/doc-1/'),
        file.buffer,
        'application/pdf',
      );
      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fileName: 'minutes-v2.pdf' }) }),
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('rejects when the document does not exist', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(service.getDownloadUrl(TENANT_ID, 'doc-1')).rejects.toThrow(NotFoundException);
    });

    it('returns a signed url and the original filename', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'doc-1', fileKey: 'tenants/t1/documents/doc-1/x.pdf', fileName: 'minutes.pdf' });
      mockStorageService.getSignedDownloadUrl.mockResolvedValue('https://signed.example/x.pdf');

      const result = await service.getDownloadUrl(TENANT_ID, 'doc-1');

      expect(result).toEqual({ url: 'https://signed.example/x.pdf', filename: 'minutes.pdf' });
    });
  });
});
