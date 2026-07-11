import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateNumberingSequenceDto } from './create-numbering-sequence.dto';

export class UpdateNumberingSequenceDto extends PartialType(OmitType(CreateNumberingSequenceDto, ['key'] as const)) {}
