import { Module } from '@nestjs/common';
import { CustomFieldDefinitionsService } from './custom-field-definitions.service';
import { CustomFieldDefinitionsController } from './custom-field-definitions.controller';
import { CustomFieldsService } from './custom-fields.service';

@Module({
  controllers: [CustomFieldDefinitionsController],
  providers: [CustomFieldDefinitionsService, CustomFieldsService],
  exports: [CustomFieldsService],
})
export class CustomFieldsModule {}
