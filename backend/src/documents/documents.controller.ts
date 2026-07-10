import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateDocumentBatchDto } from './dto/create-document-batch.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';
import { MAX_DOCUMENT_SIZE_BYTES } from '../common/constants/file-upload.constants';
import { BranchScopeService } from '../common/branch-scope/branch-scope.service';

const MAX_BATCH_FILES = 20;

@ApiTags('documents')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly branchScopeService: BranchScopeService,
  ) {}

  @ApiOperation({ summary: 'Upload a document (title/category/description/branch + file, in one call)' })
  @ApiConsumes('multipart/form-data')
  @Permissions('document.create')
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }))
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return ok(await this.documentsService.create(tenantId, user?.userId, dto, file));
  }

  @ApiOperation({ summary: 'Upload several files at once (drag-and-drop), each becoming its own document sharing category/description/branch' })
  @ApiConsumes('multipart/form-data')
  @Permissions('document.create')
  @Post('batch')
  @UseInterceptors(FilesInterceptor('files', MAX_BATCH_FILES, { storage: memoryStorage(), limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }))
  async createBatch(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentBatchDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return ok(await this.documentsService.createBatch(tenantId, user?.userId, dto, files));
  }

  @ApiOperation({ summary: 'List documents (paginated, filterable by branch/category/search) — a branch-scoped caller also sees church-wide documents' })
  @Permissions('document.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Query() query: DocumentQueryDto) {
    const visibleBranchIds = await this.branchScopeService.resolveVisibleBranchIds(tenantId, user.userId);
    const { items, total, page, pageSize, totalPages } = await this.documentsService.findAll(tenantId, query, visibleBranchIds);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one document' })
  @Permissions('document.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.documentsService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update a document\'s title/category/description/branch — not the file itself' })
  @Permissions('document.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return ok(await this.documentsService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Replace the stored file behind an existing document record (the previous file becomes a version, see /versions)' })
  @ApiConsumes('multipart/form-data')
  @Permissions('document.update')
  @Patch(':id/file')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }))
  async replaceFile(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return ok(await this.documentsService.replaceFile(tenantId, id, user?.userId, file));
  }

  @ApiOperation({ summary: 'Soft-delete a document' })
  @Permissions('document.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.documentsService.softDelete(tenantId, id));
  }

  @ApiOperation({ summary: 'Get a time-limited download URL for a document' })
  @Permissions('document.read')
  @Get(':id/download')
  async download(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.documentsService.getDownloadUrl(tenantId, id));
  }

  @ApiOperation({ summary: "List a document's superseded file versions, most recent first" })
  @Permissions('document.read')
  @Get(':id/versions')
  async listVersions(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.documentsService.listVersions(tenantId, id));
  }

  @ApiOperation({ summary: 'Get a time-limited download URL for a previous version of this document' })
  @Permissions('document.read')
  @Get(':id/versions/:versionId/download')
  async downloadVersion(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Param('versionId') versionId: string) {
    return ok(await this.documentsService.getVersionDownloadUrl(tenantId, id, versionId));
  }
}
