import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { EntityMembershipsService } from './entity-memberships.service';
import { CreateEntityMembershipDto } from './dto/create-entity-membership.dto';
import { UpdateEntityMembershipDto } from './dto/update-entity-membership.dto';
import { EntityMembershipQueryDto } from './dto/entity-membership-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('entity-memberships')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('entity-memberships')
export class EntityMembershipsController {
  constructor(private readonly service: EntityMembershipsService) {}

  @ApiOperation({ summary: 'Add an already-registered member to an entity (e.g. a Dynamic Module record) with a role' })
  @Permissions('entity_membership.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateEntityMembershipDto) {
    return ok(await this.service.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List memberships (paginated, filterable by entity/member/role)' })
  @Permissions('entity_membership.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: EntityMembershipQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.service.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one membership' })
  @Permissions('entity_membership.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.service.findOne(tenantId, id));
  }

  @ApiOperation({ summary: "Change a member's role or active status within the entity" })
  @Permissions('entity_membership.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateEntityMembershipDto) {
    return ok(await this.service.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Remove a member from the entity (deactivates the membership, keeping history)' })
  @Permissions('entity_membership.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.service.remove(tenantId, id));
  }
}
