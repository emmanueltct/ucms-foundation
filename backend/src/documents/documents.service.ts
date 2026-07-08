import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Document, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from '../common/constants/file-upload.constants';

export type UploadedFile = { buffer: Buffer; originalname: string; mimetype: string; size: number };

/**
 * Documents — see docs/document-management/business-analysis.md. Unlike
 * Asset's `file`-type custom fields (a small attachment on someone else's
 * record), a Document *is* the record: metadata and file arrive together
 * in one `POST /documents` call. The document's id is generated
 * client-side (`randomUUID`) before the row exists so the storage key can
 * be namespaced by it without a separate create-then-update round trip.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(tenantId: string, uploadedByUserId: string | undefined, dto: CreateDocumentDto, file: UploadedFile | undefined): Promise<Document> {
    this.assertValidFile(file);
    if (dto.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }

    const id = randomUUID();
    const fileKey = this.buildKey(tenantId, id, file!.originalname);
    await this.storageService.uploadObject(fileKey, file!.buffer, file!.mimetype);

    return this.prisma.document.create({
      data: {
        id,
        tenantId,
        branchId: dto.branchId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        fileKey,
        fileName: file!.originalname,
        fileSize: file!.size,
        contentType: file!.mimetype,
        uploadedByUserId,
      },
    });
  }

  async findAll(tenantId: string, query: DocumentQueryDto) {
    const where = this.buildWhere(tenantId, query);

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<Document> {
    return this.findOneRaw(tenantId, id);
  }

  async update(tenantId: string, id: string, dto: UpdateDocumentDto): Promise<Document> {
    await this.findOneRaw(tenantId, id);
    if (dto.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }

    return this.prisma.document.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
      },
    });
  }

  /** Replaces the stored file behind an existing Document — the previous object is left in the bucket, not deleted (see business analysis). */
  async replaceFile(tenantId: string, id: string, file: UploadedFile | undefined): Promise<Document> {
    this.assertValidFile(file);
    const existing = await this.findOneRaw(tenantId, id);

    const fileKey = this.buildKey(tenantId, existing.id, file!.originalname);
    await this.storageService.uploadObject(fileKey, file!.buffer, file!.mimetype);

    return this.prisma.document.update({
      where: { id },
      data: { fileKey, fileName: file!.originalname, fileSize: file!.size, contentType: file!.mimetype },
    });
  }

  async softDelete(tenantId: string, id: string): Promise<Document> {
    await this.findOneRaw(tenantId, id);
    return this.prisma.document.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  async getDownloadUrl(tenantId: string, id: string): Promise<{ url: string; filename: string }> {
    const document = await this.findOneRaw(tenantId, id);
    const url = await this.storageService.getSignedDownloadUrl(document.fileKey);
    return { url, filename: document.fileName };
  }

  private assertValidFile(file: UploadedFile | undefined): void {
    if (!file) {
      throw new BadRequestException({ code: 'DOCUMENT_FILE_REQUIRED', message: 'A file is required.' });
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'DOCUMENT_TYPE_UNSUPPORTED',
        message: 'Only PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX, or plain text files are accepted.',
      });
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException({ code: 'DOCUMENT_TOO_LARGE', message: 'Files must be 10MB or smaller.' });
    }
  }

  private buildKey(tenantId: string, documentId: string, filename: string): string {
    return `tenants/${tenantId}/documents/${documentId}/${Date.now()}-${filename}`;
  }

  private async findOneRaw(tenantId: string, id: string): Promise<Document> {
    const document = await this.prisma.document.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!document) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' });
    return document;
  }

  private buildWhere(tenantId: string, query: DocumentQueryDto): Prisma.DocumentWhereInput {
    return {
      tenantId,
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  private async assertBranchExists(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
  }
}
