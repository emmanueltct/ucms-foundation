import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { NumberingSequencesService } from './numbering-sequences.service';
import { CreateNumberingSequenceDto } from './dto/create-numbering-sequence.dto';
import { UpdateNumberingSequenceDto } from './dto/update-numbering-sequence.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('numbering-sequences')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('numbering-sequences')
export class NumberingSequencesController {
  constructor(private readonly service: NumberingSequencesService) {}

  @ApiOperation({ summary: 'Create a numbering sequence (e.g. membership numbers, receipt numbers)' })
  @Permissions('numbering_sequence.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateNumberingSequenceDto) {
    return ok(await this.service.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List numbering sequences' })
  @Permissions('numbering_sequence.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string) {
    return ok(await this.service.findAll(tenantId));
  }

  @ApiOperation({ summary: 'Update a numbering sequence (prefix, padding, or manually adjust nextValue)' })
  @Permissions('numbering_sequence.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateNumberingSequenceDto) {
    return ok(await this.service.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Delete a numbering sequence' })
  @Permissions('numbering_sequence.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.service.remove(tenantId, id));
  }
}
