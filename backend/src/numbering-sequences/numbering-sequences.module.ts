import { Module } from '@nestjs/common';
import { NumberingSequencesService } from './numbering-sequences.service';
import { NumberingSequencesController } from './numbering-sequences.controller';

@Module({
  controllers: [NumberingSequencesController],
  providers: [NumberingSequencesService],
  exports: [NumberingSequencesService],
})
export class NumberingSequencesModule {}
