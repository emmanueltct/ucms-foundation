# Functional Requirements — Finance

## FR-FIN-1 Recording a Contribution

- FR-FIN-1.1 A tenant can create a `Contribution` with required `branchId`, `contributionType`,
  `amount`, `paymentMethod`, `contributedAt`, and optional `memberId`, `currency`,
  `receiptNumber`, `notes`.
- FR-FIN-1.2 `branchId` must reference an existing, non-deleted branch within the same tenant, or
  the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-FIN-1.3 If provided, `memberId` must reference an existing, non-deleted member within the
  same tenant, or the request is rejected with `404 MEMBER_NOT_FOUND`.
- FR-FIN-1.4 `amount` must be a positive number (> 0), or the request is rejected with `422`
  (DTO validation).
- FR-FIN-1.5 `paymentMethod` must be one of `cash`, `bank_transfer`, `mobile_money`, `cheque`,
  `other`, or the request is rejected with `422`.
- FR-FIN-1.6 If `currency` is omitted, it defaults to the tenant's current `Tenant.currency` at
  creation time; once recorded, a contribution's `currency` never changes automatically.
- FR-FIN-1.7 If provided, `receiptNumber` must be unique within the tenant, or the request is
  rejected with `409 RECEIPT_NUMBER_TAKEN`.
- FR-FIN-1.8 `recordedByUserId` is set from the authenticated user making the request; it is not
  an accepted input field.

## FR-FIN-2 Listing & Reading

- FR-FIN-2.1 `GET /contributions` returns a paginated list filterable by `branchId`, `memberId`,
  `contributionType`, `paymentMethod`, `dateFrom`/`dateTo` (on `contributedAt`), and
  `includeVoided` (defaults to excluding voided records), following the Foundation module's
  standard query contract (FR-6.1).
- FR-FIN-2.2 `GET /contributions/:id` returns one contribution regardless of voided status.
- FR-FIN-2.3 `GET /contributions/summary` returns totals grouped by `contributionType`, filtered
  by the same `branchId`/`dateFrom`/`dateTo`/`includeVoided` parameters as the list endpoint.

## FR-FIN-3 Correcting a Record

- FR-FIN-3.1 `PATCH /contributions/:id` may only change `notes` and `receiptNumber` — every other
  field on a contribution is immutable once recorded (FR-FIN-3 business rule: financial records
  are corrected by voiding, not editing).
- FR-FIN-3.2 Changing `receiptNumber` via this endpoint is still subject to the per-tenant
  uniqueness check in FR-FIN-1.7.

## FR-FIN-4 Voiding a Contribution

- FR-FIN-4.1 `PATCH /contributions/:id/void` requires a non-empty `voidReason` and sets
  `isVoided=true`, `voidedAt`, and `voidedByUserId` from the authenticated user.
- FR-FIN-4.2 Voiding an already-voided contribution is rejected with
  `400 CONTRIBUTION_ALREADY_VOIDED`.
- FR-FIN-4.3 There is no un-void / restore endpoint and no hard-delete endpoint for contributions
  — a voided record stays voided permanently, and a non-existent one was never created (per the
  "financial records are never deleted" business rule).

## FR-FIN-5 Non-Functional

- FR-FIN-5.1 All contribution mutations go through the same `@Permissions(...)` guard and tenant
  scoping as every other module — no new cross-cutting mechanism is introduced.
- FR-FIN-5.2 New permission codes introduced by this module: `finance.contribution.create`,
  `finance.contribution.read`, `finance.contribution.update`, `finance.contribution.void`.
- FR-FIN-5.3 `Contribution` is added to the Prisma tenant-scoping extension's
  `TENANT_SCOPED_MODELS` set, same as `Branch`/`Member`/`Family`.
