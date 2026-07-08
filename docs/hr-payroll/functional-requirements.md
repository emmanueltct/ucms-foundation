# Functional Requirements — HR & Payroll

## FR-HR-1 Staff Records

- FR-HR-1.1 A tenant can create a `Staff` record with required `firstName`, `lastName`,
  `employmentType`, and optional `memberId`, `branchId`, `position`, `department`,
  `employmentStatus` (defaults `"active"`), `hireDate`, `baseSalary`, `salaryCurrency`, `notes`.
- FR-HR-1.2 If `branchId` is provided, it must reference an existing, non-deleted branch within
  the same tenant, or the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-HR-1.3 If `memberId` is provided, it must reference an existing, non-deleted member within
  the same tenant, or the request is rejected with `404 MEMBER_NOT_FOUND`.
- FR-HR-1.4 A member cannot be linked to two active staff records — a second link attempt is
  rejected with `409 STAFF_MEMBER_ALREADY_LINKED`.
- FR-HR-1.5 `employmentType` must be one of `full_time`, `part_time`, `contract`,
  `volunteer_stipend`. `employmentStatus` must be one of `active`, `on_leave`, `terminated`.
- FR-HR-1.6 Updating `employmentStatus` to `"terminated"` for the first time automatically sets
  `terminationDate` to the current date if it wasn't already set.
- FR-HR-1.7 `DELETE /staff/:id` soft-deletes the record (`deletedAt`, `isActive=false`); it never
  touches that staff member's `PayrollPayment` history.
- FR-HR-1.8 `GET /staff` returns a paginated, searchable (`search` matches `firstName`/`lastName`)
  list filterable by `branchId`/`employmentStatus`.

## FR-HR-2 Creating a Payroll Payment

- FR-HR-2.1 A tenant can create a `PayrollPayment` with required `staffId`, `periodStart`,
  `periodEnd`, `grossAmount`, and optional `deductions` (defaults `0`), `currency`, `notes`.
- FR-HR-2.2 `staffId` must reference an existing, non-deleted staff record within the same
  tenant, or the request is rejected with `404 STAFF_NOT_FOUND`.
- FR-HR-2.3 `deductions` cannot exceed `grossAmount`, or the request is rejected with
  `400 PAYROLL_DEDUCTIONS_EXCEED_GROSS`.
- FR-HR-2.4 `netAmount` is computed as `grossAmount - deductions` at creation time and stored;
  it is never silently recalculated afterward.
- FR-HR-2.5 If `currency` is omitted, it defaults to the staff member's `salaryCurrency`, then
  the tenant's current currency.
- FR-HR-2.6 A new payment always starts with `status: "pending"`.

## FR-HR-3 Updating, Paying, and Cancelling

- FR-HR-3.1 `PATCH /payroll-payments/:id` may update `periodStart`/`periodEnd`/`grossAmount`/
  `deductions`/`currency`/`notes` — but only while `status` is still `"pending"`; otherwise the
  request is rejected with `400 PAYROLL_PAYMENT_NOT_PENDING`. `staffId` is immutable.
  Recomputes `netAmount` if `grossAmount`/`deductions` change, re-validating FR-HR-2.3.
- FR-HR-3.2 `PATCH /payroll-payments/:id/mark-paid` is only valid while `status` is `"pending"`
  (same `PAYROLL_PAYMENT_NOT_PENDING` rejection otherwise); it sets `status: "paid"`, `paidAt`,
  and `paidByUserId` from the authenticated user.
- FR-HR-3.3 `PATCH /payroll-payments/:id/cancel` requires a non-empty `cancelReason` and is only
  valid while `status` is `"pending"`; it sets `status: "cancelled"`, `cancelledAt`,
  `cancelledByUserId`, `cancelReason`. A `"paid"` payment can never be cancelled.
- FR-HR-3.4 `GET /payroll-payments` returns a paginated list filterable by `staffId`/`status`.

## FR-HR-4 Non-Functional

- FR-HR-4.1 All staff/payroll mutations go through the same `@Permissions(...)` guard and tenant
  scoping as every other module.
- FR-HR-4.2 New permission codes: `staff.create`, `staff.read`, `staff.update`, `staff.delete`,
  `payroll.payment.create`, `payroll.payment.read`, `payroll.payment.update`,
  `payroll.payment.pay`, `payroll.payment.cancel`.
- FR-HR-4.3 `Staff` and `PayrollPayment` are added to the Prisma tenant-scoping extension's
  `TENANT_SCOPED_MODELS` set.
