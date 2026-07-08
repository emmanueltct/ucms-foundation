# Module 11: Visitor & Follow-up Management

## 1. Business Description

A church wants to know who's visiting for the first time, where they heard about the church,
who's responsible for reaching out to them, and whether that outreach is actually happening —
not just a name jotted on a guest card that never gets followed up on. This module tracks a
visitor from first contact through a history of follow-up interactions to (optionally)
becoming a `Member`. It's the platform's first module with an explicit "convert one kind of
record into another" action — a `Visitor` who joins the church becomes a `Member`, and the two
records stay linked afterward.

This is Module 11 — it depends on Church & Hierarchy (Module 1)'s branches (a visitor may
optionally be tied to one), Member & Family Management (Module 2)'s members (both for "who
invited them" and for the conversion target), and the Foundation module's `User`s (who a
visitor is assigned to for follow-up). No other module depends on it.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator / Follow-up Coordinator | Records visitors, assigns them to a follow-up team member, reviews outstanding follow-ups |
| Assigned User | Logs each follow-up interaction (a call, a text, a visit) as it happens |

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
- **Follow-up interactions are an append-only log, not a single "last contacted" field.**
  `VisitorFollowUp` accumulates a history the same way `PayrollPayment` accumulates against a
  `Staff` record — there's no `PATCH`/`DELETE` on a follow-up entry, because a call that
  happened, happened; correcting the record isn't a real requirement the way correcting a
  mis-typed attendance headcount is (rule #11). If a follow-up was logged in error, log a
  corrective note as a new entry rather than editing history.
- **`method` and `source` are `ConfigItem`s, not hard-coded enums** — the same reasoning
  applied to every other "type" in this platform (rule #3): how a church's follow-up team
  actually reaches out, and how visitors actually hear about the church, both vary enough to
  belong in configuration.
- **Soft delete, always** (rule #4) for `Visitor` — a visitor record carries no money or
  audit-trail obligation, so it uses the plain pattern, not Finance's stricter one.
  `VisitorFollowUp` has no delete path at all (see above), the same "append-only, no removal"
  shape `AuditLog` already has elsewhere in the schema.

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
