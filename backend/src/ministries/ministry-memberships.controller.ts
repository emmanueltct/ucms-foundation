import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { MinistryMembershipsService } from './ministry-memberships.service';
import { CreateMinistryMembershipDto } from './dto/create-ministry-membership.dto';
import { UpdateMinistryMembershipDto } from './dto/update-ministry-membership.dto';
import { MinistryMembershipQueryDto } from './dto/ministry-membership-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('ministry-memberships')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('ministry-memberships')
export class MinistryMembershipsController {
  constructor(private readonly membershipsService: MinistryMembershipsService) {}

  @ApiOperation({ summary: 'Add a member to a ministry with a role' })
  @Permissions('ministry.membership.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateMinistryMembershipDto) {
    return ok(await this.membershipsService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List memberships (paginated, filterable by ministry/member/role)' })
  @Permissions('ministry.membership.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: MinistryMembershipQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.membershipsService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one membership' })
  @Permissions('ministry.membership.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.membershipsService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: "Change a member's role or active status within a ministry" })
  @Permissions('ministry.membership.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateMinistryMembershipDto) {
    return ok(await this.membershipsService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Remove a member from a ministry (deactivates the membership, keeping volunteer history)' })
  @Permissions('ministry.membership.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.membershipsService.remove(tenantId, id));
  }
}
