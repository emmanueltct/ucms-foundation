import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResourceAssignmentsService } from './resource-assignments.service';
import { CreateResourceAssignmentDto } from './dto/create-resource-assignment.dto';
import { ResourceAssignmentQueryDto } from './dto/resource-assignment-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('resource-assignments')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('resource-assignments')
export class ResourceAssignmentsController {
  constructor(private readonly service: ResourceAssignmentsService) {}

  @ApiOperation({ summary: 'Attach a resource (module/report/dashboard/workflow/document category) to an organizational scope' })
  @Permissions('resourceassignment.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateResourceAssignmentDto) {
    return ok(await this.service.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List resource assignments, optionally filtered by scope and/or resource type' })
  @Permissions('resourceassignment.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: ResourceAssignmentQueryDto) {
    return ok(await this.service.findAll(tenantId, query));
  }

  @ApiOperation({ summary: 'Remove a resource assignment' })
  @Permissions('resourceassignment.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.service.remove(tenantId, id));
  }
}
