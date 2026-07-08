# Module 9: Reports & Analytics

## 1. Business Description

Every module so far (Finance, Attendance, Membership, Events, HR & Payroll) is a system of
record for one kind of activity. None of them answer a cross-cutting question a Church
Administrator or Denominational Overseer actually asks: "how is giving trending this year?",
"is attendance growing or shrinking?", "how many new members joined last quarter?", "what did
payroll cost us last month, by department?". This module is a read-only reporting layer over
data that already exists in those modules — it introduces no new system of record of its own.

This is Module 9 — it depends on Finance (Module 3), Attendance (Module 4), Member & Family
Management (Module 2), Events (Module 7), and HR & Payroll (Module 8) as data sources, but
none of those modules depend on it. Deleting this module entirely would not affect any other
module's correctness; it only reads.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actor most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator / Denominational Overseer | Views dashboards and trend charts to understand the church's overall health at a glance, rather than reading raw lists module by module |

## 3. Key Business Rules

- **No new Prisma models.** Unlike every prior module, this one has no table of its own —
  `ReportsService` queries `Contribution`, `AttendanceRecord`, `Member`, `Event`, `Staff`, and
  `PayrollPayment` directly, always tenant-scoped like everything else. See design decision #22
  in the root [README.md](../../README.md) for why a reporting layer over existing modules
  doesn't need one, unlike the Configuration Engine's `ConfigItem` (rule #3), which exists
  precisely because *that* concern couldn't be satisfied by an existing table.
- **A permission code for viewing, not for each report.** `reports.view` guards every endpoint
  in this module. There's no `reports.finance.view` / `reports.attendance.view` split — these
  are read-only aggregates, not separately-owned records the way a `Contribution` or `Staff`
  row is, so one permission covering "can see the analytics dashboard" is the right grain.
- **Month-bucketed trends are zero-filled.** A month with no contributions/attendance/new
  members still appears in `byMonth` with `total: 0`, so a line chart never silently skips a
  quiet month — the frontend doesn't need to reconstruct the calendar itself.
- **The default date range is the trailing 12 months, not "all time."** Omitting `dateFrom`
  defaults to 11 months before `dateTo` (which itself defaults to today). A tenant with years
  of history gets a bounded, meaningful chart by default; passing explicit `dateFrom`/`dateTo`
  overrides it for a custom window.
- **Voided contributions and cancelled payroll payments are always excluded**, matching the
  business rules Finance (rule #10) and HR & Payroll (rule #21) already enforce at their own
  layer — a report never re-litigates what "counts" differently than the module that owns the
  record.
- **Membership growth reports new members *and* a running cumulative-active count together.**
  A raw "new members per month" chart alone can't answer "how big is the church now" without
  the reader doing mental arithmetic; `cumulativeActive` on each month's bucket answers both
  questions from one series.

## 4. Out of Scope for This Module

- **Saved/scheduled reports, exports (PDF/CSV), or emailed report digests** — every endpoint
  here computes its result live, on request. Persisting a "saved report definition" or wiring
  a scheduled export through the Communication module (Module 6) is a real, contained future
  feature, but nothing in the current brief calls for it yet, and adding it now would be
  building for a hypothetical requirement rather than an actual one.
- **Cross-tenant / platform-wide analytics** (e.g. "average attendance across all tenants") —
  every query here is scoped to one tenant, same as every other module. A platform-operator
  rollup is a different actor and a different data-access boundary, not a natural extension of
  this module.
- **Configurable/custom report builder** (pick your own dimensions/measures) — the four report
  shapes here (finance, attendance, membership growth, payroll) are fixed, chosen to match the
  questions actually asked of a church admin. A generic pivot-table-style builder is a much
  larger feature that isn't justified by the current requirement.
