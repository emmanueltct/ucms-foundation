# Module 5: Ministry & Volunteer Management

## 1. Business Description

Beyond hierarchy, people, money, and attendance, a church organizes its actual work into
ministries — Youth, Choir, Ushering, Missions — each staffed by volunteers who may lead, serve
regularly, or simply belong. This module records both halves of that: the ministry itself, and
who's involved in it and in what capacity.

This is Module 5 — it builds on the Church & Hierarchy module (Module 1)'s branches (a ministry
may optionally scope to one) and the Member & Family module (Module 2)'s members (who the
volunteers are). It does not depend on Finance (Module 3) or Attendance (Module 4).

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Ministry Leader | Typically holds a `MinistryMembership.role = "leader"` record and manages their own ministry's roster |
| Church Administrator | Holds `ministry.*` permissions by default and can create/edit any ministry |
| Member | The person a `MinistryMembership` attaches a volunteer role to |

## 3. Key Business Rules

- **A ministry is a flat entity, not a hierarchy.** Unlike `Branch`, `Ministry` has no
  self-reference — nothing in the platform's brief calls for sub-ministry nesting the way Church
  & Hierarchy explicitly does for branches. If a future requirement needs it, it can be added
  without disrupting this shape (the same reasoning already applied to `Family`).
- **A ministry may be church-wide or scoped to one branch.** `Ministry.branchId` is optional —
  `null` means the ministry operates across the whole tenant (e.g. a single citywide choir),
  matching how `Contribution.memberId` and `AttendanceRecord.memberId` use an optional FK for a
  similar "may or may not apply" distinction.
- **Ministry "type" is configuration, not schema**, following the rule every prior module has
  established: `Ministry.ministryType` is a free-form key that should correspond to a
  `ConfigItem` in namespace `ministry_type` (`youth`, `choir`, `ushering`, `missions`, ...),
  unvalidated against the catalog at write time — the catalog exists so the UI offers sensible
  choices, not as a hard foreign key. (This supersedes the Foundation module's original
  `ConfigItem` namespace *example* of `"ministry"` as a bare label list — now that volunteer
  assignments need real relations, `Ministry` is a first-class entity per rule #3 in the root
  README: "reach for a dedicated table when the data needs its own relations... beyond a label +
  JSON blob.")
- **Leadership is a role value, not a denormalized field.** Unlike `Family.headOfFamilyId`
  (a unique FK enforcing exactly one head), `Ministry` has no `leaderId` column — "leader" is
  just one of `MinistryMembership.role`'s values (`leader` | `volunteer` | `member`), with no
  uniqueness constraint. A ministry can reasonably have co-leaders; a family cannot reasonably
  have two heads.
- **A member has at most one membership record per ministry.** Re-adding a member who already
  has a record for that ministry is rejected — change their existing record's `role`/`isActive`
  instead of creating a second one.
- **Removing a member from a ministry deactivates the membership; it is never hard-deleted.**
  The row stays for volunteer-history purposes (who served where, and when), mirroring how
  `Family` intentionally preserves historical membership shape rather than erasing it.
- **Deleting a ministry deactivates all of its memberships**, similar in spirit to `Branch`
  cascading deactivation to descendants — but here it's a one-level cascade (memberships, not
  further nested entities), since `Ministry` has no children of its own.

## 4. Out of Scope for This Module

- **Volunteer scheduling** (e.g. "who's serving this Sunday") — this module records durable
  *membership* in a ministry, not shift-by-shift scheduling. A future scheduling layer could
  read `MinistryMembership` to know who's eligible to be scheduled.
- **Ministry-scoped attendance** — Attendance (Module 4) intentionally deferred a `ministryId`
  column on `AttendanceRecord` until this module existed; wiring the two together (attendance
  taken *for* a specific ministry meeting) is a natural follow-up now that `Ministry` exists, but
  isn't part of this pass.
- **Ministry budgets / expense tracking** — belongs to Finance, if/when Finance grows an expense
  side; this module only tracks people, not money.
