import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NumberingSequence } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNumberingSequenceDto } from './dto/create-numbering-sequence.dto';
import { UpdateNumberingSequenceDto } from './dto/update-numbering-sequence.dto';

@Injectable()
export class NumberingSequencesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateNumberingSequenceDto): Promise<NumberingSequence> {
    const existing = await this.prisma.numberingSequence.findUnique({ where: { tenantId_key: { tenantId, key: dto.key } } });
    if (existing) {
      throw new ConflictException({ code: 'NUMBERING_SEQUENCE_KEY_TAKEN', message: `A sequence with key "${dto.key}" already exists.` });
    }
    return this.prisma.numberingSequence.create({
      data: { tenantId, key: dto.key, prefix: dto.prefix ?? '', nextValue: dto.nextValue ?? 1, padding: dto.padding ?? 4 },
    });
  }

  async findAll(tenantId: string): Promise<NumberingSequence[]> {
    return this.prisma.numberingSequence.findMany({ where: { tenantId }, orderBy: { key: 'asc' } });
  }

  async update(tenantId: string, id: string, dto: UpdateNumberingSequenceDto): Promise<NumberingSequence> {
    await this.findOneOrThrow(tenantId, id);
    return this.prisma.numberingSequence.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string): Promise<{ id: string }> {
    await this.findOneOrThrow(tenantId, id);
    await this.prisma.numberingSequence.delete({ where: { id } });
    return { id };
  }

  /**
   * Atomically claims and returns the next formatted number for `key`, or
   * `null` if no sequence is configured under that key — callers (Members,
   * Contributions) treat `null` as "no auto-fill, manual entry required."
   * The increment itself is a single `UPDATE ... next_value = next_value + 1`,
   * which Postgres serializes at the row level, so concurrent callers never
   * receive the same number without needing an explicit transaction wrapper.
   */
  async getNext(tenantId: string, key: string): Promise<string | null> {
    const sequence = await this.prisma.numberingSequence.findUnique({ where: { tenantId_key: { tenantId, key } } });
    if (!sequence) return null;

    const updated = await this.prisma.numberingSequence.update({
      where: { id: sequence.id },
      data: { nextValue: { increment: 1 } },
    });
    const usedValue = updated.nextValue - 1;
    return `${sequence.prefix}${String(usedValue).padStart(sequence.padding, '0')}`;
  }

  private async findOneOrThrow(tenantId: string, id: string): Promise<NumberingSequence> {
    const sequence = await this.prisma.numberingSequence.findFirst({ where: { id, tenantId } });
    if (!sequence) throw new NotFoundException({ code: 'NUMBERING_SEQUENCE_NOT_FOUND', message: 'Sequence not found.' });
    return sequence;
  }
}
