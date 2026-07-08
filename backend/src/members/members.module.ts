import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { FamiliesModule } from '../families/families.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';

@Module({
  imports: [FamiliesModule, CustomFieldsModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
