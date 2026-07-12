import { Module } from '@nestjs/common';
import { FormAssignmentNotifier } from './form-assignment-notifier.service';
import { EligibilityResolverModule } from '../eligibility/eligibility-resolver.module';
import { CommunicationModule } from '../../communication/communication.module';

@Module({
  imports: [EligibilityResolverModule, CommunicationModule],
  providers: [FormAssignmentNotifier],
  exports: [FormAssignmentNotifier],
})
export class FormAssignmentNotifierModule {}
