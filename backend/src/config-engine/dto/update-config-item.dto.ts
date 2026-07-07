import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateConfigItemDto } from './create-config-item.dto';

export class UpdateConfigItemDto extends PartialType(OmitType(CreateConfigItemDto, ['namespace', 'key'] as const)) {}
