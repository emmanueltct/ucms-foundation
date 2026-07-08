# Module 7: Events

## 1. Business Description

Beyond regular services (Attendance, Module 4), a church runs one-off or occasional gatherings —
conferences, youth camps, outreach trips, socials — that need advance registration, a headcount
before the day, and a capacity limit in some cases. This module is the system of record for
that: scheduling an event, and tracking who's registered, whether they're a known member or a
walk-in guest.

This is Module 7 — it builds on the Church & Hierarchy module (Module 1)'s branches (an event
may optionally scope to one) and the Member & Family module (Module 2)'s members (a registrant
may optionally be a named member). It does not depend on Finance, Attendance, Ministry, or
Communication, though a future pass could reuse Communication to send registration confirmations
(see Out of Scope).

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator / Ministry Leader | Creates events and manages the registration roster |
| Member | May register for an event, or a Ministry Leader may register a walk-in guest on their behalf |

## 3. Key Business Rules

- **An event is a flat entity, not a hierarchy** — like `Ministry`, no self-reference. Nothing
  in the platform's brief calls for sub-event nesting.
- **An event may be church-wide or scoped to one branch.** `Event.branchId` is optional, the
  same optional-FK pattern `Ministry.branchId` already established.
- **A registrant is either a named `Member` or a walk-in guest — never neither.**
  `EventRegistration.memberId` is optional; when it's omitted, `guestName` is required. This
  mirrors `AttendanceRecord`'s member-vs-anonymous split, but here a "guest" carries a name (and
  optionally contact info), unlike an anonymous head-count.
- **Only named members are deduplicated.** A member cannot register twice for the same event
  (enforced via a unique constraint), but nothing stops multiple distinct guest registrations —
  guests have no stable identifier to de-duplicate against, the same reasoning
  `AttendanceRecord` applies to anonymous head-counts vs. named check-ins.
- **Capacity is a soft cap enforced at registration time, not a hard schema constraint.** If
  `Event.capacity` is set, a new registration is rejected with `409 EVENT_FULL` once the count of
  non-cancelled registrations reaches it. There is no waitlist — see Out of Scope.
- **Cancelling a registration keeps the row.** `DELETE /event-registrations/:id` sets
  `status: "cancelled"`, never a hard delete, so a church can still see who backed out and when —
  the same "soft delete, always" reasoning applied everywhere else, expressed here as a status
  value rather than `deletedAt`/`isActive` since `EventRegistration` already has a natural status
  lifecycle (`registered` → `attended` | `cancelled`).
- **Deleting an event cancels its registrations.** Mirrors `Ministry`'s cascade-deactivate: a
  one-level cascade (registrations, not further nested entities) since `Event` has no children of
  its own beyond registrations.

## 4. Out of Scope for This Module

- **Waitlisting** — once `capacity` is reached, a registration attempt is simply rejected
  (`EVENT_FULL`); there's no automatic promotion from a waitlist when a spot opens up. A future
  pass could add a `waitlisted` status and a promotion job.
- **Registration confirmation notifications** — the Communication module (Module 6) exists and
  could plausibly send a confirmation email/SMS on successful registration, but this module
  doesn't call it yet. Wiring that in is a contained follow-up (inject `NotificationsService`,
  call `create` after a successful registration, wrapped so a notification failure never fails
  the registration itself) — not included now to keep this module's surface focused and
  independently testable.
- **Payment / ticketing for paid events** — this module tracks *who's coming*, not money;
  a paid-event flow would layer `Finance` (Module 3) contributions on top of a registration,
  not extend this module's schema.
- **Recurring events** (e.g. "every first Sunday") — each `Event` is a single scheduled
  occurrence; a recurring series would be a scheduling convenience built by creating multiple
  `Event` rows, not a new relationship this module needs to model.
