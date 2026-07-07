import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { SetFamilyHeadDto } from './dto/set-family-head.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('families')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('families')
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @ApiOperation({ summary: 'Create a family/household' })
  @Permissions('family.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateFamilyDto) {
    return ok(await this.familiesService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List families (paginated, searchable by name)' })
  @Permissions('family.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: PaginationQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.familiesService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one family' })
  @Permissions('family.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.familiesService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'List members currently in this family' })
  @Permissions('family.read')
  @Get(':id/members')
  async findMembers(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.familiesService.findMembers(tenantId, id));
  }

  @ApiOperation({ summary: 'Update name/address/phone/notes' })
  @Permissions('family.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateFamilyDto) {
    return ok(await this.familiesService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Set (or clear) the head of family' })
  @Permissions('family.update')
  @Patch(':id/head')
  async setHead(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: SetFamilyHeadDto) {
    return ok(await this.familiesService.setHead(tenantId, id, dto.memberId));
  }

  @ApiOperation({ summary: 'Soft-delete a family (members are not affected)' })
  @Permissions('family.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.familiesService.softDelete(tenantId, id));
  }
}
