import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Base DTO for any endpoint marked `@RequiresAuditReason()` — extend this
 * (e.g. `class RejectMemberDto extends RequireReasonDto {}`) rather than
 * redeclaring `reason` per action, so every mandatory-comment field gets
 * the same validation message and Swagger description.
 */
export class RequireReasonDto {
  @ApiProperty({ description: 'Why this change is being made — becomes part of the permanent audit history.' })
  @IsString()
  @MinLength(3)
  reason: string;
}
