import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';
import { MAX_DOCUMENT_SIZE_BYTES } from '../common/constants/file-upload.constants';

@ApiTags('documents')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

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

  @ApiOperation({ summary: 'List documents (paginated, filterable by branch/category/search)' })
  @Permissions('document.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: DocumentQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.documentsService.findAll(tenantId, query);
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

  @ApiOperation({ summary: 'Replace the stored file behind an existing document record' })
  @ApiConsumes('multipart/form-data')
  @Permissions('document.update')
  @Patch(':id/file')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }))
  async replaceFile(@CurrentTenantId() tenantId: string, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return ok(await this.documentsService.replaceFile(tenantId, id, file));
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
}
