import { PartialType } from '@nestjs/swagger';
import { CreateSmallGroupDto } from './create-small-group.dto';

export class UpdateSmallGroupDto extends PartialType(CreateSmallGroupDto) {}
