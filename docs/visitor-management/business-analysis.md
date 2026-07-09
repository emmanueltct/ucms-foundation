# Module 11: Visitor & Follow-up Management

## 1. Business Description

A church wants to know who's visiting for the first time, where they heard about the church,
who's responsible for reaching out to them, and whether that outreach is actually happening —
not just a name jotted on a guest card that never gets followed up on. Visitors don't always
arrive alone, either: a delegation, a visiting choir, a whole family, or a mission team shows
up together and needs to be tracked as a group as well as (optionally) as individuals. This
module tracks both an individual `Visitor` and a `VisitorGroup` from first contact through a
history of tenant-configurable activities (not just "follow-up calls" — First Visit,
Counseling, Prayer, Baptism Class, Marriage Class, Deliverance, Bible Study, Outreach,
Conference, or anything else a church defines) to, for individuals, (optionally) becoming a
`Member`. It's the platform's first module with an explicit "convert one kind of record into
another" action — a `Visitor` who joins the church becomes a `Member`, and the two records
stay linked afterward.

This is Module 11 — it depends on Church & Hierarchy (Module 1)'s branches (a visitor or group
may optionally be tied to one), Member & Family Management (Module 2)'s members (both for "who
invited them" and for the conversion target), the Foundation module's `User`s (who a visitor or
group is assigned to for follow-up), and the Custom Fields mechanism (Module 9) for
activity-type-specific extra fields. No other module depends on it.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator / Follow-up Coordinator | Records visitors and groups, assigns them to a follow-up team member, reviews outstanding follow-ups |
| Assigned User | Logs each activity (a call, a class, a prayer session, a visit) as it happens, against an individual or a whole group |

## 3. Key Business Rules

- **A visitor's status is a plain, freely-editable lifecycle field — except for one value.**
  `Visitor.status` (`new` → `contacted` → `scheduled_visit` → `joined` | `no_response` |
  `closed`) carries no financial audit-trail obligation, so unlike `PayrollPayment` (rule #10/
  #21 in the root README) it doesn't need `mark-paid`/`cancel`-style dedicated endpoints for
  most transitions — `PATCH /visitors/:id` can set it directly. The one exception is
  `"joined"`: setting it that way is rejected (`400 VISITOR_USE_CONVERT_ENDPOINT`) because
  becoming a member is a real side effect (linking `convertedMemberId`), not just a label
  change — the same reasoning that makes `Member.transfer` and `Family.setHead` dedicated
  actions instead of plain field edits (rules #6/#8 in the root README).
- **Converting a visitor reuses the Members module rather than duplicating it.**
  `PATCH /visitors/:id/convert` takes an existing `memberId` — the caller creates the `Member`
  first (through the normal Member & Family Management flow, with all of *its* validation),
  then links it here. This avoids a second, parallel "create a member" code path that would
  drift from the real one over time.
- **A visitor can only be converted once, and a member can only be linked to one visitor.**
  `Visitor.convertedMemberId` is unique — attempting to link a second visitor to an
  already-linked member is rejected with `409 MEMBER_ALREADY_LINKED_TO_VISITOR`, and
  re-converting an already-converted visitor is rejected with `400 VISITOR_ALREADY_CONVERTED`.
- **Activities are an append-only log, not a single "last contacted" field.** `VisitorActivity`
  accumulates a history the same way `PayrollPayment` accumulates against a `Staff` record —
  there's no `PATCH`/`DELETE` on an activity entry, because a call or class that happened,
  happened; correcting the record isn't a real requirement the way correcting a mis-typed
  attendance headcount is (rule #11). If an activity was logged in error, log a corrective note
  as a new entry rather than editing history.
- **Activities target exactly one of an individual `Visitor` or a whole `VisitorGroup`, never
  both, never neither** — a family's shared "hosted for lunch" note belongs on the group; a
  specific person's "completed Baptism Class" belongs on them individually. `VisitorActivity`
  carries both `visitorId` and `visitorGroupId` as nullable foreign keys, and
  `VisitorActivitiesService.assertExactlyOneTarget` enforces the invariant at the service layer
  (Prisma has no portable single-`CHECK`-constraint DSL for "exactly one of N nullable
  columns," so, like several other cross-field invariants in this codebase, it's enforced in
  code rather than the database).
- **`activityType` composes into Custom Fields the same way Assets' `assetCategory` does.**
  Rather than a hard-coded "follow-up method" enum, `activityType` is a `ConfigItem` key
  (namespace `visitor_activity_type`) and `VisitorActivitiesService.entityTypeFor` composes it
  into `visitor_activity:{activityType}` — the exact `asset:{assetCategory}` pattern Assets
  (Module 10) established. A Baptism Class activity can require a "class completed" checkbox
  and a certificate number; a Prayer activity needs neither; a tenant adds both without a code
  change, exactly the "no activity form is hardcoded" requirement from the platform's
  configurability mandate.
- **`groupType` and `source` are `ConfigItem`s, not hard-coded enums** — the same reasoning
  applied to every other "type" in this platform (rule #3): how a delegation is categorized,
  and how visitors actually hear about the church, both vary enough to belong in configuration.
- **Soft delete, always** (rule #4) for `Visitor` and `VisitorGroup` — neither carries a money or
  audit-trail obligation, so both use the plain pattern, not Finance's stricter one.
  `VisitorActivity` has no delete path at all (see above), the same "append-only, no removal"
  shape `AuditLog` already has elsewhere in the schema.
- **An individual belonging to a group doesn't change how they're tracked individually** —
  `Visitor.visitorGroupId` is just an optional link; every existing Visitor capability (status
  lifecycle, follow-up assignment, conversion to a Member) still applies per-person even when
  they arrived as part of a delegation or family.

## 4. Out of Scope for This Module

- **Automated follow-up reminders / task assignment notifications** — `assignedToUserId`
  records *who* is responsible, but nothing here proactively notifies them or escalates an
  overdue follow-up. Wiring that through the Communication module (Module 6) — e.g. a
  scheduled job that nudges an assignee after N days of no follow-up — is a real, contained
  future feature, not included now.
- **A visitor-facing check-in kiosk / self-service form** — this module is the back-office
  record-keeping side; how a visitor's information actually gets captured on a Sunday morning
  (a paper card transcribed later, a tablet at a welcome desk, a QR code) is a UX/hardware
  concern layered on top of `POST /visitors`, not something this module's API needs to know
  about.
- **Multiple visits before conversion aggregated into one record** — each visit is currently
  assumed to create (or already have) one `Visitor` row; there's no "this person has visited
  3 times" rollup beyond what a `search` by name/phone/email surfaces manually. A future pass
  could deduplicate by phone/email if that turns out to matter in practice.
- **A group "converting" the same way an individual does** — there's no bulk "convert this
  whole delegation to members" action; each member who joins is converted individually via the
  existing per-visitor flow. A group is a tracking convenience, not a membership unit.
