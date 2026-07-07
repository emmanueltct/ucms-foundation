# Module 4: Attendance

## 1. Business Description

Once a church has its hierarchy (Module 1), its people (Module 2), and its finances (Module 3)
tracked, it needs to know who actually showed up — and how many, when a full roll call by name
isn't practical (a large Sunday service, a public event). This module records attendance either
against a named `Member` or as an anonymous head-count, always against the `Branch` where it was
taken, and summarizes totals by service type for reporting and, later, the AI-driven attendance
forecasting called for in the platform's broader vision.

This is Module 4 — it builds on the Foundation module (Module 0)'s tenancy/auth/Configuration
Engine, the Church & Hierarchy module (Module 1)'s branches, and the Member & Family module
(Module 2)'s members. It does not depend on Finance (Module 3); the two were simply built back
to back.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Ministry Leader / Pastor / Priest | Typically records attendance for their service or ministry |
| Church Administrator | Holds `attendance.*` permissions by default and can review/correct records |
| Member | The (optional) person an attendance entry is attached to |

## 3. Key Business Rules

- **An attendance record is attached to exactly one `Branch`** (where it was taken) and
  **either one named `Member` or an anonymous head-count** — never both, and never neither.
  This mirrors Finance's "optional FK" shape for `Contribution.memberId`, but here the absence
  of a member isn't a special case (anonymous giving) so much as the *common* case for a large
  service where individual check-in isn't practical.
- **`headcount` behaves differently depending on whether `memberId` is set.** A named
  individual's attendance always counts as exactly 1 (enforced by the service layer, not
  accepted as client input when `memberId` is present); an anonymous entry requires a positive
  `headcount` supplied by the caller (an usher's tally, a door-counter reading, etc.).
- **Service "type" is configuration, not schema**, following the same rule Modules 1–3 already
  established: `AttendanceRecord.serviceType` is a free-form key that should correspond to a
  `ConfigItem` in namespace `service_type` (`sunday_service`, `bible_study`, `youth_service`,
  ...), and `attendanceMethod` similarly maps to namespace `attendance_method` (`manual`,
  `qr_checkin`, `self_checkin`) — neither is validated against the catalog at write time, same
  as `Member.membershipCategory` and `Contribution.contributionType`.
- **A named member cannot be recorded twice for the same branch/service/date.** Unlike
  `Contribution.receiptNumber` (optional uniqueness), this is enforced whenever `memberId` is
  present — re-submitting the same check-in is almost always a client-side double-submit, not a
  legitimate second attendance. Anonymous head-count entries are exempt: multiple ushers may
  each submit a count for the same service without conflict.
- **Attendance uses the Foundation module's plain "soft delete, always" rule, not Finance's
  stricter void-only pattern.** A financial record's audit trail matters in a way a head-count
  typo's doesn't — correcting an attendance record's fields in place (`PATCH`) or soft-deleting
  it outright are both allowed, unlike `Contribution`, which can only be voided.
- **`recordedByUserId` is captured automatically from the authenticated user**, not accepted as
  client input, matching Finance's `Contribution.recordedByUserId`.

## 4. Out of Scope for This Module

- **Attendance forecasting / AI insights** — the PDF's broader vision calls for AI-driven
  attendance forecasting; this module only records the underlying data it would train on.
  Belongs to the later AI Features phase.
- **QR-code generation/scanning infrastructure** — `attendanceMethod: "qr_checkin"` is a valid
  *label* for how a record was captured, but this module doesn't generate or scan QR codes
  itself; that's a mobile-app/Communication-adjacent concern layered on top of this same
  `POST /attendance-records` endpoint.
- **Session/event scheduling** (e.g. "Sunday Service, 9am, main hall" as its own entity with a
  start/end time) — `serviceType` + `attendedAt` (a date) is sufficient for the core "who/how
  many were here on this day" requirement; a richer Events model is a separate future module.
- **Ministry-scoped attendance** — the PDF mentions "per-ministry attendance records"; this pass
  only ties attendance to a `Branch`, since Ministry & Volunteer Management (a later module)
  doesn't exist yet. A `ministryId` column can be added then without disrupting this shape.
