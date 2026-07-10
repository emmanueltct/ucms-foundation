# Mandatory Audit Reasons + Deadlines — Named Hot-Spots

## 1. Business Description

Requirement #7 (mandatory audit comments) and #8 (deadline management) were built as
generic, reusable infrastructure in Module 15 (`AuditService`, `@RequiresAuditReason()`,
`Deadline`) and have since been applied, as each later module shipped, to every action the
original requirements actually named: Hierarchy Requirement submission decisions (Module
16), Dynamic Module status changes (Module 17), and Member Registration decisions (Module
19) all already require a reason. This final pass closes the two remaining named
hot-spots that predate Module 15 — **member delete/status-change** and **Visitor
convert/status-change** — and wires Module 15's `Deadline` into Hierarchy Requirement
submissions, which had documented the intent since Module 16 shipped but never actually
called `DeadlinesService.assertOpen`.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).

## 3. Key Business Rules

- **A status change is audited; a routine field edit is not.** `Member.update` and
  `Visitor.update` are still one general-purpose endpoint each (name, phone, address, ...)
  — adding `@RequiresAuditReason()` to the whole route would force a reason on every
  routine edit, which nothing in the requirements asked for. Instead, `UpdateMemberDto`/
  `UpdateVisitorDto` make `reason` conditionally required (`@ValidateIf`) only when
  `membershipStatus`/`status` is present in that specific request — enforced by
  class-validator at the DTO layer (a `422` field error), not by the blanket,
  route-level `RequiresAuditReasonGuard`. The service layer then writes to `AuditService`
  only when the status actually differs from what was already stored.
- **Delete is a clean, singular action, so it uses the standard route-level
  `@RequiresAuditReason()` unconditionally** — `DELETE /members/:id` always requires a
  reason, no conditional logic needed, the same as `Visitor.convertToMember` already does.
- **`Visitor.convertToMember` reuses `RequireReasonDto`** (extending it onto
  `ConvertVisitorDto`) rather than inventing a second reason-carrying shape — the
  existing convention `HierarchyRequirementSubmission`'s approve/reject and Member
  Registration's approve/reject already established.
- **Hierarchy Requirement submissions now actually call
  `DeadlinesService.assertOpen`** before `submit()` marks a cycle submitted — a no-op if
  no `Deadline` was ever configured for that submission (the default, so tenants that
  don't set deadlines are unaffected), otherwise blocking a locked or closed cycle with
  `400 DEADLINE_NOT_OPEN`. This was documented as the intended composition since Module
  16 shipped but had never actually been wired into code until now.
- **The frontend prompts for a reason at the point of action**, not as a separate
  confirmation step — the same `window.prompt`-based pattern already used for Hierarchy
  Requirement/Dynamic Module/Deadline decisions, applied here to Member removal and
  Visitor status changes/conversion for consistency across every reason-carrying action
  in the admin UI.

## 4. Out of Scope

- **Every other mutation in the system** — this remains a bounded, named list (member
  delete/status-change, Visitor convert/status-change), not a blanket policy. Routine
  field edits everywhere else in the platform stay unaudited, consistent with the scope
  line Module 15 itself already drew.
- **Deadlines on Dynamic Module records** — the original plan noted this as a "going
  forward" extension point (a module definition opting into `hasDeadline: true`), not a
  requirement of this pass; no Dynamic Module definition exists today that needs one, and
  adding an unused configuration flag would be speculative.
