# Module 1: Church & Hierarchy Management

## 1. Business Description

Member Management and Finance both need to attach records (a member, a contribution) to a
place within the church — but "place" means something different for every denomination:
a Catholic parish sits under a diocese, an independent Pentecostal ministry may have a single
building with no sub-structure at all, and a large network church might have HQ → region →
local branch → cell group. This module builds the one structure flexible enough to represent
all of them, plus the onboarding flow that gets a brand-new tenant from "just provisioned" to
"ready for Member Management to build on."

This is Module 1 — it builds directly on the Foundation module (Module 0)'s tenant, auth, and
Configuration Engine, and is itself a prerequisite for every module that needs to say
"this record belongs to *this* part of the church."

## 2. Actors

Same actor set as the Foundation module ([business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Platform Admin | Provisions the tenant and (optionally) its first Church Administrator account |
| Church Administrator | Walks through the onboarding wizard; owns the branch hierarchy going forward |
| Pastor / Priest, Ministry Leader, Finance Officer, Member | Later modules scope their own data to a branch; this module only defines the tree they attach to |

## 3. Key Business Rules

- A church's organizational hierarchy is modeled as a single **self-referencing tree**
  (`Branch.parentBranchId`) of arbitrary depth — not a fixed set of levels — so it can
  represent a flat independent church (one root branch, no children) just as well as a
  multi-level denominational hierarchy (diocese → parish → branch → cell).
- **Branch "type" is configuration, not schema.** `Branch.branchType` is a free-form key that
  should correspond to a `ConfigItem` in namespace `branch_type` (e.g. `diocese`, `parish`,
  `district`, `cell`), following the Foundation module's rule that new "types" belong in the
  Configuration Engine. This module does not hard-code a fixed label set.
- **Exactly one branch may be flagged `isHeadquarters`** per tenant at a time; setting the flag
  on a branch clears it from whichever branch previously held it.
- **A branch cannot become its own descendant's parent.** Every move (creation with a parent,
  or an explicit re-parent) is checked against the target's ancestor chain to reject cycles.
- **Deactivating a branch cascades to its descendants** (soft toggle only — see Foundation's
  "soft delete, always" rule) since a branch whose parent no longer operates shouldn't appear
  active on its own. Reactivating a branch does **not** cascade back down, since descendants may
  have been independently deactivated for unrelated reasons.
- **Onboarding is a wizard, not a single form.** A newly provisioned tenant walks through
  branding (already on `Tenant`) → hierarchy setup (this module's branch tree) → first admin
  user, and finishes with an idempotent "complete onboarding" call that guarantees at least one
  headquarters branch exists before later modules (Member Management) can assume one does.
- **The wizard's hierarchy step is a thin UI over `branch_type` config, not new schema.** Since
  every church names its own levels differently (province/diocese/parish/cell vs. a flat
  independent church with none of those), the frontend wizard (`app/onboarding/page.tsx`) walks
  the admin through: (1) naming their levels — each one becomes a `ConfigItem` in namespace
  `branch_type` via the existing Configuration Engine endpoints, no new module code; (2) creating
  the headquarters branch (calling the already-idempotent `PATCH /tenant/onboarding/complete`,
  now invoked mid-wizard rather than only at the very end, which is safe precisely because that
  endpoint was designed to be callable more than once); (3) optionally adding further branches
  underneath it (`POST /branches`) before finishing. Every step is a call to an endpoint this
  module already exposed for the standalone Branches page — the wizard adds no backend surface.
- Provisioning a tenant may optionally bootstrap its first Church Administrator account in the
  same call (`CreateTenantDto.adminEmail`) — this grants only tenant-scoped permission codes
  (never the `platform.*` catalog), distinct from the Foundation demo seed's admin role, which
  intentionally holds every permission for local-dev convenience only.

## 4. Out of Scope for This Module

- Ministry structure and volunteer scheduling (Module 3 — Ministry & Volunteer Management)
  may reuse this module's tree pattern, or the plain Configuration Engine, depending on whether
  ministries need their own hierarchy; that decision is deferred to that module.
- Member-to-branch assignment itself (Module 2 — Member & Family Management) — this module only
  builds the branches members will reference.
- Email delivery of the onboarding admin's temporary password — today it's returned once in the
  API response for the Platform Admin to relay out of band; wiring real delivery belongs to the
  Communication module.
- A persisted, resumable step-by-step wizard state machine — the wizard is a thin frontend flow
  over existing tenant/branch endpoints plus one idempotent completion call, not a new
  `OnboardingProgress` table. Revisit only if a future requirement needs the platform to resume
  a wizard across devices/sessions.
