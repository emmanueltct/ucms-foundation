# Module 8: HR & Payroll

## 1. Business Description

A church runs on more than volunteers — a senior pastor, an administrator, an accountant, and
often facilities/support staff draw a salary. This module records those employment relationships
(HR) and the actual disbursements made against them (Payroll), giving a church a system of record
for both who's on staff and what they've been paid.

This is Module 8 — it builds on the Church & Hierarchy module (Module 1)'s branches (a staff
member may work at one) and the Member & Family module (Module 2)'s members (a staff member may
also be a congregant). It does not depend on Finance, Attendance, Ministry, Communication, or
Events, though a future pass could route payroll disbursements through Finance's ledger.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator | Manages staff records and processes payroll payments |
| Finance Officer | Likely also holds `payroll.*` permissions, since payroll is money leaving the church |
| Staff member | The subject of a `Staff` record — may or may not also be a `Member` |

## 3. Key Business Rules

- **`Staff` is the person's HR record, not a reference to one.** Unlike `Contribution`,
  `AttendanceRecord`, and `EventRegistration` (transactional records that *reference* a person),
  `Staff` always carries its own `firstName`/`lastName` — a contracted accountant or IT support
  person may never be a congregation `Member` at all. `memberId` is an optional *link* for staff
  who happen to also be members, not a substitute for the record's own identity.
- **At most one active staff record per member.** `Staff.memberId` is unique — a member can't
  have two simultaneous employment records. (Re-hiring after a prior record was soft-deleted is
  fine; the constraint only applies among non-deleted records, enforced at the application layer
  the same way `assertMemberNotAlreadyStaff` checks it, since the DB unique index itself can't
  express "unique among non-deleted rows" without a partial index.)
- **`position` and `department` are configuration, not schema** — free-form `ConfigItem` keys
  (namespaces `staff_position`, `department`) following the standing rule; job titles and
  department structures vary enormously by denomination and by church size.
- **`employmentType` and `employmentStatus` are small fixed sets, not configuration** — payroll
  logic reasons structurally about them (e.g. a `contract` role might not accrue benefits; a
  `terminated` staff member shouldn't appear in an active payroll run), the same reasoning
  `Contribution.paymentMethod` and `Member.membershipStatus` already established for their own
  small fixed sets.
- **A `PayrollPayment` follows Finance's stricter pattern, not Attendance's plain one.** Money
  leaving the church carries the same audit-trail obligation Finance's `Contribution` does:
  `netAmount` is computed once at creation and never silently recalculated, and a payment can only
  be edited or cancelled while still `"pending"` — once `"paid"`, it's a fixed historical fact,
  the same "never edited once resolved" reasoning `Contribution` applies via voiding, expressed
  here through a `status` field's lifecycle instead (`pending` → `paid` | `cancelled`) since
  `PayrollPayment` already needed a status field for its own workflow (see design decision #19
  in the root README, which `EventRegistration.status` already established this same choice for).
- **Cancelling requires a reason and is only possible before payment.** Mirrors
  `Contribution.void`'s mandatory `voidReason`, but scoped tighter: a `"paid"` payment cannot be
  cancelled at all (see Out of Scope) — only correct it going forward via a new payment/adjustment,
  never retroactively.
- **Deleting a staff record never touches its payroll history.** Soft-deleting `Staff`
  (`deletedAt`) doesn't cascade to `PayrollPayment` rows the way deleting a `Ministry` cascades to
  its memberships — a payment already made or scheduled is a financial fact independent of whether
  the staff record is later archived.

## 4. Out of Scope for This Module

- **Reversing a "paid" payment** — if a payment was made in error, this module doesn't support
  un-paying it; a correcting entry (a negative-amount adjustment, or simply documenting it in
  `notes` on a follow-up payment) is a process question for the church, not a state this module
  needs to model.
- **Tax/statutory deduction calculation** — `deductions` is a single number the caller supplies;
  this module doesn't compute PAYE, pension contributions, or other statutory withholding rules,
  which vary by jurisdiction and are a compliance concern beyond this module's scope.
- **Payslip generation / delivery** — no PDF or emailed payslip is produced; that's a natural
  Communication-module follow-up (attach a generated payslip and notify the staff member), not a
  prerequisite for recording that a payment happened.
- **Attendance/leave tracking for staff** — `employmentStatus: "on_leave"` records *that* someone
  is on leave, not a leave-request workflow (dates, approval, balance) — that's a distinct future
  concern layered on top of the `Staff` record this module already provides.
- **Routing payments through Finance's ledger** — `PayrollPayment` is its own record, not a
  `Contribution` (which only ever represents money coming *in*). A future pass could post payroll
  disbursements to a general ledger if double-entry accounting is added; not needed for the core
  "who got paid what, when" requirement.
