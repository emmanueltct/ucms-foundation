import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { SmallGroupMembershipsService } from './small-group-memberships.service';
import { CreateSmallGroupMembershipDto } from './dto/create-small-group-membership.dto';
import { UpdateSmallGroupMembershipDto } from './dto/update-small-group-membership.dto';
import { SmallGroupMembershipQueryDto } from './dto/small-group-membership-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('small-group-memberships')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('small-group-memberships')
export class SmallGroupMembershipsController {
  constructor(private readonly membershipsService: SmallGroupMembershipsService) {}

  @ApiOperation({ summary: 'Add a member to a small group with a role (subject to the group\'s capacity)' })
  @Permissions('small_group.membership.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateSmallGroupMembershipDto) {
    return ok(await this.membershipsService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List memberships (paginated, filterable by group/member/role)' })
  @Permissions('small_group.membership.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: SmallGroupMembershipQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.membershipsService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one membership' })
  @Permissions('small_group.membership.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.membershipsService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: "Change a member's role or active status within a small group" })
  @Permissions('small_group.membership.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateSmallGroupMembershipDto) {
    return ok(await this.membershipsService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Remove a member from a small group (deactivates the membership, keeping roster history)' })
  @Permissions('small_group.membership.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.membershipsService.remove(tenantId, id));
  }
}
