import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { AssignDepartmentResourceDto } from './dto/assign-department-resource.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

/**
 * No static `@Permissions()` — like `DynamicModuleRecordsController`, this
 * is gated by the per-tenant dynamic `dynamicmodule.{departmentsModuleId}.
 * {action}` codes generated for the pre-seeded departments module, checked
 * inside `DepartmentsService`/`DynamicModuleRecordsService`.
 */
@ApiTags('departments')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @ApiOperation({ summary: 'Create a department (e.g. Finance, HR, Customer Care — any custom name)' })
  @Post()
  async create(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDepartmentDto) {
    return ok(await this.service.create(tenantId, dto, user));
  }

  @ApiOperation({ summary: 'List departments' })
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return ok(await this.service.findAll(tenantId, user));
  }

  @ApiOperation({ summary: 'Get one department' })
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return ok(await this.service.findOne(tenantId, id, user));
  }

  @ApiOperation({ summary: 'Update a department' })
  @Patch(':id')
  async update(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return ok(await this.service.update(tenantId, id, dto, user));
  }

  @ApiOperation({ summary: 'Soft-delete a department' })
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return ok(await this.service.remove(tenantId, id, user));
  }

  @ApiOperation({ summary: 'List modules/reports/dashboards/workflows/document categories assigned to this department' })
  @Get(':id/resources')
  async listResources(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return ok(await this.service.listResources(tenantId, id, user));
  }

  @ApiOperation({ summary: 'Assign a resource (module/report/dashboard/workflow/document category) to this department' })
  @Post(':id/resources')
  async assignResource(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignDepartmentResourceDto,
  ) {
    return ok(await this.service.assignResource(tenantId, id, dto, user));
  }

  @ApiOperation({ summary: "Remove a resource from this department's assignments" })
  @Delete(':id/resources/:assignmentId')
  async removeResource(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return ok(await this.service.removeResource(tenantId, id, assignmentId, user));
  }
}
