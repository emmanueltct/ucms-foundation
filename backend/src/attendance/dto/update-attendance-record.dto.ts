import { PartialType } from '@nestjs/swagger';
import { CreateAttendanceRecordDto } from './create-attendance-record.dto';

/**
 * Unlike Branch/Member, attendance has no dedicated "move" endpoint — a
 * record's fields carry no hierarchy/uniqueness-of-role concern that would
 * demand one, so branchId/memberId may be corrected here directly.
 */
export class UpdateAttendanceRecordDto extends PartialType(CreateAttendanceRecordDto) {}
