import { Module } from '@nestjs/common';
import { MyFormsService } from './my-forms.service';
import { MyFormsController } from './my-forms.controller';
import { EligibilityResolverModule } from '../common/eligibility/eligibility-resolver.module';

@Module({
  imports: [EligibilityResolverModule],
  controllers: [MyFormsController],
  providers: [MyFormsService],
})
export class MyFormsModule {}
