import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetQueryDto } from './dto/asset-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { MAX_DOCUMENT_SIZE_BYTES } from '../common/constants/file-upload.constants';

@ApiTags('assets')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @ApiOperation({ summary: 'Register an asset under a category (church-wide or scoped to a branch)' })
  @Permissions('asset.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateAssetDto) {
    return ok(await this.assetsService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List assets (paginated, filterable by branch/category/status/search)' })
  @Permissions('asset.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: AssetQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.assetsService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one asset, including its category-specific custom fields' })
  @Permissions('asset.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.assetsService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: "Update an asset (assetCategory is fixed — it can't be changed after creation)" })
  @Permissions('asset.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return ok(await this.assetsService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Soft-delete an asset' })
  @Permissions('asset.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.assetsService.softDelete(tenantId, id));
  }

  @ApiOperation({ summary: 'Upload a document (e.g. proof of purchase, insurance) against a file-type custom field' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'fieldKey', required: true })
  @Permissions('asset.update')
  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }))
  async uploadDocument(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Query('fieldKey') fieldKey: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return ok(await this.assetsService.uploadDocument(tenantId, id, fieldKey, file));
  }

  @ApiOperation({ summary: 'Get a time-limited download URL for a previously uploaded document' })
  @Permissions('asset.read')
  @Get(':id/documents/:fieldKey/download')
  async downloadDocument(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Param('fieldKey') fieldKey: string) {
    return ok(await this.assetsService.getDocumentDownloadUrl(tenantId, id, fieldKey));
  }
}
