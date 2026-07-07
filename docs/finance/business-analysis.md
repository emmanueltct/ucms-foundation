# Module 3: Finance

## 1. Business Description

Once a church has its hierarchy (Module 1) and its people (Module 2), it needs to track the
money that moves through it — tithes, offerings, building-fund contributions — against both
*where* it was given (a `Branch`) and, where known, *who* gave it (a `Member`). This module is
the system of record for that: recording contributions, correcting mistakes without erasing the
audit trail, and summarizing totals by fund and branch.

This is Module 3 — it builds on the Foundation module (Module 0)'s tenancy/auth/Configuration
Engine, the Church & Hierarchy module (Module 1)'s branches, and the Member & Family module
(Module 2)'s members.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actor most relevant here:

| Actor | Relevance to this module |
|---|---|
| Finance Officer | A scoped role (permissions limited to `finance.*`) that records and reviews contributions |
| Church Administrator | Holds `finance.*` permissions by default (see Module 1's demo-seed rationale) and can review/void records |
| Member | The (optional) giver a contribution is attached to |

## 3. Key Business Rules

- **A contribution is attached to exactly one `Branch`** (where it was received/counted) and
  **optionally one `Member`** (who gave it) — an anonymous cash-offering-basket contribution is
  still a valid record with no `memberId`, following the same "optional FK" shape Module 2 used
  for `Member.familyId`.
- **Contribution "type" (fund) is configuration, not schema.** `Contribution.contributionType` is
  a free-form key that should correspond to a `ConfigItem` in namespace `contribution_type`
  (`tithe`, `offering`, `building_fund`, ...) — already seeded by the Foundation module — per the
  standing rule that new "types" belong in the Configuration Engine, not a new table or enum.
  This mirrors how `Member.membershipCategory` is treated in Module 2: neither this module nor
  Module 2 validates the key against the `ConfigItem` catalog at write time — the catalog exists
  so the *UI* offers the right choices, not as a hard foreign key.
- **Payment method is a small fixed set, not tenant configuration** — `cash`, `bank_transfer`,
  `mobile_money`, `cheque`, `other` — because later reporting/reconciliation logic reasons
  structurally about it (e.g. "only cash contributions need a deposit-slip reference"), the same
  reasoning Module 2 applied to `membershipStatus` rather than `membershipCategory`.
- **`currency` is captured on the contribution itself, not read live from `Tenant.currency`.** A
  tenant's currency could change over the life of the system (unlikely, but not impossible); a
  contribution's historical value must never silently reinterpret itself in a different currency.
  It defaults to the tenant's current currency at creation time but is then a plain, independent
  field.
- **Financial records are never deleted — they are voided.** This is a deliberate, stronger
  variant of the Foundation module's "soft delete, always" rule: for every other module, deleting
  a record just means `deletedAt`/`isActive=false`, and there's typically also a plain update path
  for correcting mistakes. For a financial record, even a plain field-level correction after the
  fact would break the audit trail a Finance Officer or auditor needs. So a contribution is
  either exactly as recorded, or explicitly voided (`isVoided`, `voidedAt`, `voidReason`,
  `voidedByUserId`) with a mandatory reason — never hard-deleted, and never silently edited. There
  is no `PATCH /contributions/:id` in this module; `notes` and `receiptNumber` are the only
  fields correctable in place, since they carry no financial meaning of their own.
- **`recordedByUserId` is captured automatically from the authenticated user**, not accepted as
  client input — a contribution always knows who entered it into the system, for the same
  audit-trail reason voiding requires a reason instead of a delete.
- **Voided contributions are excluded from summary totals by default.** `GET
  /contributions/summary` only includes `includeVoided=true` records when explicitly asked, so a
  corrected mistake doesn't silently double-count in a report unless someone deliberately wants
  to see the full history including reversed entries.
- **`receiptNumber` is unique per tenant when provided**, following the same optional-uniqueness
  pattern as Module 2's `Member.membershipNumber`.

## 4. Out of Scope for This Module

- **Pledges / recurring giving commitments** — a pledge is a promise to give over time, distinct
  from a `Contribution`, which only records money actually received. A future iteration could add
  a `Pledge` model and reconcile contributions against it; not needed for the core "record what
  came in" requirement.
- **Payment gateway integration (mobile money APIs, card processors)** — `paymentMethod` records
  *how* a contribution was received, but this module doesn't call out to any payment provider;
  contributions are always recorded after the fact, whether the money moved digitally or by hand.
- **Multi-currency conversion / consolidated reporting across tenants with different
  currencies** — `currency` is stored per contribution for historical accuracy (see above), but
  this module doesn't convert or roll up amounts across different currencies within a summary.
- **Batch/session-based collection entry** (e.g. "Sunday service collection, 12 contributions
  logged together") — valuable UX for a Finance Officer, but a workflow layered on top of the
  same `Contribution` CRUD defined here, not a prerequisite for it.
- **Receipt PDF generation / delivery** — `receiptNumber` is a plain string a Finance Officer can
  reference on a physical or externally-generated receipt; wiring actual PDF generation or email
  delivery belongs to the Communication module, per the same reasoning Module 1 deferred
  onboarding-password delivery.
