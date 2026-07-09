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
    documentVersion: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
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
        service.create(TENANT_ID, USER_ID, baseDto as any, { ...file, size: 26 * 1024 * 1024 }),
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

      await expect(service.replaceFile(TENANT_ID, 'doc-1', USER_ID, undefined)).rejects.toThrow(BadRequestException);
    });

    it('snapshots the current file into a DocumentVersion before overwriting it', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        fileKey: 'tenants/t1/documents/doc-1/old.pdf',
        fileName: 'minutes-v1.pdf',
        fileSize: 500,
        contentType: 'application/pdf',
      });
      mockPrisma.document.update.mockResolvedValue({ id: 'doc-1' });

      await service.replaceFile(TENANT_ID, 'doc-1', USER_ID, { ...file, originalname: 'minutes-v2.pdf' });

      expect(mockPrisma.documentVersion.create).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT_ID,
          documentId: 'doc-1',
          fileKey: 'tenants/t1/documents/doc-1/old.pdf',
          fileName: 'minutes-v1.pdf',
          fileSize: 500,
          contentType: 'application/pdf',
          replacedByUserId: USER_ID,
        },
      });
    });

    it('uploads a new object and updates the file fields', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'doc-1', fileKey: 'k', fileName: 'old.pdf', fileSize: 1, contentType: 'application/pdf' });
      mockPrisma.document.update.mockResolvedValue({ id: 'doc-1' });

      await service.replaceFile(TENANT_ID, 'doc-1', USER_ID, { ...file, originalname: 'minutes-v2.pdf' });

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

  describe('createBatch', () => {
    const batchDto = { category: 'minutes' };
    const file2 = { ...file, originalname: 'photo.jpg', mimetype: 'image/jpeg' };

    it('rejects when no files are provided', async () => {
      await expect(service.createBatch(TENANT_ID, USER_ID, batchDto as any, [])).rejects.toThrow(BadRequestException);
      await expect(service.createBatch(TENANT_ID, USER_ID, batchDto as any, undefined)).rejects.toThrow(BadRequestException);
    });

    it('rejects the whole batch if any file is invalid, before uploading any of them', async () => {
      await expect(
        service.createBatch(TENANT_ID, USER_ID, batchDto as any, [file, { ...file, mimetype: 'application/zip' }]),
      ).rejects.toThrow(BadRequestException);
      expect(mockStorageService.uploadObject).not.toHaveBeenCalled();
    });

    it('creates one document per file, sharing category/description/branchId', async () => {
      mockPrisma.document.create.mockResolvedValueOnce({ id: 'doc-1' }).mockResolvedValueOnce({ id: 'doc-2' });

      const result = await service.createBatch(TENANT_ID, USER_ID, { ...batchDto, titlePrefix: 'Board Photos' } as any, [file, file2]);

      expect(result).toHaveLength(2);
      expect(mockPrisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: 'Board Photos — minutes.pdf', fileName: 'minutes.pdf' }) }),
      );
      expect(mockPrisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: 'Board Photos — photo.jpg', fileName: 'photo.jpg' }) }),
      );
    });

    it('titles each document after its own filename when titlePrefix is omitted', async () => {
      mockPrisma.document.create.mockResolvedValue({ id: 'doc-1' });

      await service.createBatch(TENANT_ID, USER_ID, batchDto as any, [file]);

      expect(mockPrisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: 'minutes.pdf' }) }),
      );
    });
  });

  describe('listVersions', () => {
    it('rejects when the document does not exist', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(service.listVersions(TENANT_ID, 'doc-1')).rejects.toThrow(NotFoundException);
    });

    it('returns versions most recent first', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'doc-1' });
      mockPrisma.documentVersion.findMany.mockResolvedValue([{ id: 'v2' }, { id: 'v1' }]);

      const result = await service.listVersions(TENANT_ID, 'doc-1');

      expect(mockPrisma.documentVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, documentId: 'doc-1' }, orderBy: { createdAt: 'desc' } }),
      );
      expect(result).toEqual([{ id: 'v2' }, { id: 'v1' }]);
    });
  });

  describe('getVersionDownloadUrl', () => {
    it('rejects when the document does not exist', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(service.getVersionDownloadUrl(TENANT_ID, 'doc-1', 'v1')).rejects.toThrow(NotFoundException);
    });

    it('rejects when the version does not exist for this document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'doc-1' });
      mockPrisma.documentVersion.findFirst.mockResolvedValue(null);

      await expect(service.getVersionDownloadUrl(TENANT_ID, 'doc-1', 'v1')).rejects.toThrow(NotFoundException);
    });

    it('returns a signed url for the historical file', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'doc-1' });
      mockPrisma.documentVersion.findFirst.mockResolvedValue({ id: 'v1', fileKey: 'tenants/t1/documents/doc-1/old.pdf', fileName: 'minutes-v1.pdf' });
      mockStorageService.getSignedDownloadUrl.mockResolvedValue('https://signed.example/old.pdf');

      const result = await service.getVersionDownloadUrl(TENANT_ID, 'doc-1', 'v1');

      expect(result).toEqual({ url: 'https://signed.example/old.pdf', filename: 'minutes-v1.pdf' });
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
