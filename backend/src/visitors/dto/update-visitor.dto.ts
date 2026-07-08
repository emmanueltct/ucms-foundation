import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateVisitorDto } from './create-visitor.dto';

const VISITOR_STATUSES = ['new', 'contacted', 'scheduled_visit', 'joined', 'no_response', 'closed'] as const;

/**
 * `status` isn't settable at creation (every visitor starts "new") but is a
 * plain, freely-editable field here — unlike PayrollPayment's status, a
 * visitor's follow-up stage carries no financial audit-trail obligation, so
 * it doesn't need dedicated mark-paid/cancel-style endpoints. The one
 * exception is "joined", which is only ever set via `POST
 * /visitors/:id/convert` since it also links `convertedMemberId`.
 */
export class UpdateVisitorDto extends PartialType(CreateVisitorDto) {
  @ApiPropertyOptional({ enum: VISITOR_STATUSES })
  @IsOptional()
  @IsIn(VISITOR_STATUSES)
  status?: string;
}
