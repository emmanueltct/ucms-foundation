# Module 14: Member Activities & Personal History

## 1. Business Description

A church wants to see a member's whole journey in one place — not just the ministries they
serve in or the services they attended, but the sacraments they've received, the trainings
they've completed, the certificates they've earned, and the leadership roles they've held.
Much of that already has a home: Ministry & Volunteer Management (Module 5) tracks ministry
roles, Small Groups (Module 13) tracks group membership, Events (Module 7) tracks
registrations, Attendance (Module 4) tracks service headcounts, and Finance (Module 3) tracks
giving. What's been missing is (a) a place for everything that *isn't* already one of those —
a baptism, a completed leadership course, a certificate — and (b) a single view that merges all
of it into one chronological timeline per member.

This module adds both: a new, tenant-configurable `MemberActivity` log for the first gap, and
a read-only aggregation report (`GET /reports/members/:id/activity-history`) for the second.
It depends on Member & Family Management (Module 2), the Custom Fields mechanism (per-type
extra fields), and reads (without depending on, in the code sense) Ministry, Small Groups,
Events, Attendance, and Finance data through the Reports module.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator / Pastor | Logs a member's activity (a baptism performed, a training completed) and reviews a member's full history before a pastoral visit or leadership decision |
| Member | The subject of the history — has no direct access in this pass (see Out of Scope) |

## 3. Key Business Rules

- **`MemberActivity` exists for what other modules don't already track — it is not a
  replacement for them.** Ministry service, small group membership, event attendance, service
  attendance, and giving all keep their own dedicated models with their own richer behavior
  (roles, statuses, void/reactivate rules). Duplicating any of them into `MemberActivity` would
  create two sources of truth for the same fact. `MemberActivity` is for the remainder:
  sacraments, trainings, certificates, leadership appointments, counseling sessions, and
  one-off volunteer work that doesn't belong to a specific ministry record.
- **`activityType` composes into Custom Fields exactly like Visitor & Follow-up Management's
  `VisitorActivity` does.** `MemberActivitiesService.entityTypeFor` produces
  `member_activity:{activityType}` (a `ConfigItem` key, namespace `member_activity_type`) —
  the same `asset:{assetCategory}` / `visitor_activity:{activityType}` composition trick,
  applied a third time. A Baptism activity can require an officiant name; a Certificate
  Earned activity can require a certificate number; neither requires a schema change.
- **Activities are an append-only log**, the same "history doesn't get rewritten" shape
  `VisitorActivity` and `AuditLog` already use — no update or delete endpoint.
- **The activity-history report introduces no new Prisma models of its own** — it composes
  `MinistryMembership`, `SmallGroupMembership`, `EventRegistration`, `AttendanceRecord`,
  `Contribution`, and the new `MemberActivity`, the same "Reports adds no new tables"
  discipline documented in `docs/reports/business-analysis.md`. It lives in `ReportsService`
  rather than `MembersService` because it's a cross-module read, exactly like every other
  report in that module.
- **The merged `timeline` is sorted, not just concatenated.** Every source contributes entries
  with a `kind` and a `date`; the report sorts the combined list by date, descending, so a
  church sees "what happened, in order" rather than five separate lists to cross-reference
  manually.

## 4. Out of Scope for This Module

- **A member-facing self-service view of their own history** — this pass is back-office only
  (an admin/pastor reviewing a member's record), gated by the same `reports.view` permission
  every other cross-module report uses. A member portal is a plausible future module, not this
  one.
- **Editing or annotating ministry/small-group/event/attendance/contribution entries from this
  report** — the timeline is read-only; corrections happen through each source module's own
  endpoints (e.g. `PATCH /ministry-memberships/:id`), preserving each module's own validation
  and audit trail.
- **Automatic activity creation from other modules** (e.g. auto-logging "completed Baptism
  Class" when a linked Small Group's curriculum finishes) — every `MemberActivity` today is
  logged explicitly by a user. Wiring automatic triggers is a real future feature once a
  concrete workflow needs it, not a speculative one now.
- **Attendance/contribution pagination beyond the most recent 50 rows** — the report caps
  `attendance.recent` and `contributions.recent` at 50 (with `totalCount`/`totalAmount`
  computed separately over the full history) to keep the endpoint fast for long-tenured
  members; a dedicated paginated endpoint can be added if a real need for "see all 400 giving
  records inline" emerges.
