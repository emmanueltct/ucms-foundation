# Module 13: Small Groups & Children's Ministry

## 1. Business Description

Beyond Sunday services (Attendance, Module 4) and volunteer serving teams (Ministry & Volunteer
Management, Module 5), a church organizes its congregation into smaller discipleship and
fellowship structures — home groups, cell groups, Bible studies — and, separately, age-graded
children's and youth classes (Sunday School). This module is the system of record for both: a
named group with a roster, a meeting schedule, a location, and (for children's/youth classes)
an age range.

This is Module 13 — it depends on Church & Hierarchy (Module 1)'s branches (a group may
optionally be scoped to one) and Member & Family Management (Module 2)'s members (the roster).
No other module depends on it.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator / Small Groups Coordinator | Creates groups, sets schedule/capacity/age range, manages rosters |
| Member | Joins a group as a participant, or leads/co-leads one |

## 3. Key Business Rules

- **This is a distinct module from Ministry & Volunteer Management, despite the structural
  similarity.** `SmallGroup`/`SmallGroupMembership` mirror `Ministry`/`MinistryMembership`
  closely on purpose (flat, optionally branch-scoped, unique name per tenant, role-based
  membership) — the shape already proven there fits here too. But the two model different
  things: Ministry is *who serves where* (ushering, media, choir); this module is
  *discipleship/fellowship structure and children's classes*. Reusing the Ministry pattern's
  shape isn't the same as reusing the Ministry table — see rule #13 in the root README on not
  reaching for a similar-looking pattern just because it exists, and the flip side of that
  same discipline: reusing one *because* the requirements genuinely match, which they do here.
- **A small group carries scheduling, capacity, and age-range fields a ministry has no use
  for.** `meetingDay`/`meetingTime`/`location` describe a recurring weekly meeting; `capacity`
  keeps a home group "small" the way its name implies; `minAge`/`maxAge` scope a children's or
  youth class to the right age band. None of these make sense on a volunteer serving team.
- **`meetingDay` is a fixed seven-value set, not a `ConfigItem`.** Unlike `groupType` (which
  varies by church), the days of the week don't vary by tenant — the same reasoning that makes
  `PayrollPayment.status` or `Asset.status` a fixed enum rather than configuration (rule #3's
  boundary: only reach for `ConfigItem` when the *set of values itself* is tenant-specific).
- **Capacity is a soft cap enforced at membership-creation time**, the exact pattern
  `EventRegistration` already established for `Event.capacity` (rule from Events' business
  analysis): once the count of active memberships reaches `SmallGroup.capacity`, a new
  membership is rejected with `409 SMALL_GROUP_FULL`. There's no waitlist, for the same reason
  Events doesn't have one.
- **Leadership is a role value, not a denormalized field** — `SmallGroupMembership.role`
  (`leader` | `co_leader` | `member`) mirrors `MinistryMembership.role` exactly (rule #14): a
  small group can reasonably have a co-leader, so there's no unique `SmallGroup.leaderId` the
  way `Family` has `headOfFamilyId`.
- **Soft delete, always** (rule #4), and deleting a group deactivates its roster rather than
  cascading a hard delete — the same "preserve history" approach `Ministry`'s deletion already
  uses.

## 4. Out of Scope for This Module

- **Child check-in / guardian pickup verification.** A children's ministry class here is
  tracked the same way any other small group is — a roster of `Member` rows. Physical
  check-in/check-out safety workflows (verifying the adult picking up a child matches an
  authorized guardian, printing a matching security tag) are a substantial, safety-critical
  feature on their own and not something this module's API attempts. `Attendance` (Module 4)
  remains the place per-session headcounts are recorded if a church wants that for a class.
- **Curriculum tracking** (what a Sunday School class is teaching, lesson plans, materials) —
  this module tracks *who's in the group and when it meets*, not instructional content.
- **Recurring meeting exceptions** (e.g. "no meeting on the 5th Sunday") — `meetingDay`/
  `meetingTime` describe the group's normal recurring schedule; one-off cancellations or
  changes aren't modeled here, the same way `Event`'s single-occurrence model doesn't try to
  express recurrence rules either.
