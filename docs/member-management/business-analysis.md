# Module 2: Member & Family Management

## 1. Business Description

Every other module still to come — Finance (who gave a contribution), Attendance (who showed
up), Communication (who to message) — needs to say "this record belongs to *this person*."
This module is where that person is first recorded: a member profile attached to a `Branch`
(Module 1), optionally grouped into a `Family`/household, with the membership lifecycle
(visitor → active member → transferred/deceased) tracked over time.

This is Module 2 — it builds directly on the Foundation module (Module 0)'s tenancy/auth/
Configuration Engine and the Church & Hierarchy module (Module 1)'s branch tree. It is itself a
prerequisite for every module that needs to attach a record to a specific person.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator | Manages members and families across the whole tenant |
| Pastor / Priest, Ministry Leader | Read/manage members within their own branch (branch-scoped permission assignment is a Role concern, not this module's) |
| Member | The subject of the record; may later get a self-service login (out of scope here — see below) |

## 3. Key Business Rules

- **A member belongs to exactly one `Branch`.** Membership without a "place" doesn't make sense
  once Module 1 exists — every member profile carries a required `branchId`, following the same
  tenant-scoped-FK pattern used elsewhere.
- **Changing a member's branch is a dedicated action, not a plain field edit.** `PATCH
  /members/:id/transfer` mirrors the branch-hierarchy module's "move" endpoint: it validates the
  target branch exists in the same tenant before changing `branchId`, so a member can never be
  silently left pointing at another tenant's branch or a deleted one.
- **A family is a household grouping, not a hierarchy.** Unlike branches, families are flat —
  `Family` has no self-reference. A member's `familyId` is optional (a single adult with no
  household on record is still a valid member) and is a plain, direct field on `Member` (no
  cycle risk, so no dedicated "move" endpoint is needed the way branches needed one).
- **A family may designate one member as its head.** `Family.headOfFamilyId` references a
  `Member`, set only through `PATCH /families/:id/head`, which requires the target member to
  already belong to that family. If that member is later removed from the family or soft-deleted,
  the head reference is cleared automatically — the same "don't leave a dangling reference to a
  gone record" principle Module 1 applies when clearing the headquarters flag.
- **Membership category is configuration, not schema.** Following the Foundation module's rule
  ("new types belong in the Configuration Engine"), `Member.membershipCategory` is a free-form
  key that should correspond to a `ConfigItem` in namespace `membership_category` (e.g.
  `full_member`, `associate`, `visitor`) — this module does not hard-code the category list.
- **Membership status is a small fixed lifecycle, not tenant configuration.** Unlike category
  (which varies by denomination), the states a membership record moves through —
  `active` / `inactive` / `transferred` / `deceased` — are structural to how every later module
  (e.g. "only count active members in this Sunday's attendance") reasons about a member, so it's
  a validated enum on the model rather than a `ConfigItem`.
- **Soft delete, always.** Removing a member sets `deletedAt`/`isActive=false`, never a hard
  delete, so historical records (an attendance entry, a contribution) referencing that member
  stay valid — consistent with Module 0's and Module 1's rule.
- **Deactivating/soft-deleting a family does not cascade to its members.** A family record going
  away (household relocated, data cleanup) shouldn't silently deactivate the people in it —
  contrast with Module 1, where deactivating a branch *does* cascade, because a branch closing
  really does mean its sub-branches stop operating. A family is just a label members point to.

## 4. Out of Scope for This Module

- **Member self-service login.** Whether a `Member` record ever gets its own `User` account (for
  a members' portal) is a future decision; today `Member` and `User` are unrelated tables — a
  church administrator's `User` account is distinct from any `Member` profile they might also
  have.
- **Attendance, contribution, or ministry-assignment history** — those are Attendance, Finance,
  and Ministry & Volunteer Management (later modules); this module only builds the member profile
  those modules will reference by `memberId`.
- **Bulk import (CSV/Excel) of existing member rolls** — valuable for onboarding an existing
  church, but a separate feature to layer on top of the CRUD endpoints defined here, not a
  prerequisite for them.
- **Member photo upload flow** — `Member.photoUrl` is a plain string field (the storage module
  already provides S3-compatible upload plumbing per Module 0); wiring a dedicated upload
  endpoint is deferred until a module needs it end-to-end.
