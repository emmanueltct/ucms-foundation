# API Design — HR & Payroll

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Staff (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/staff` | `staff.create` | Create a staff record (optionally linked to a member) |
| GET | `/staff` | `staff.read` | Paginated/searchable list (`?branchId=&employmentStatus=&search=`) |
| GET | `/staff/:id` | `staff.read` | Get one staff record |
| PATCH | `/staff/:id` | `staff.update` | Update a staff record |
| DELETE | `/staff/:id` | `staff.delete` | Soft-delete (payroll history untouched) |

## Payroll Payments (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/payroll-payments` | `payroll.payment.create` | Create a pending payment for a staff member |
| GET | `/payroll-payments` | `payroll.payment.read` | Paginated list (`?staffId=&status=`) |
| GET | `/payroll-payments/:id` | `payroll.payment.read` | Get one payment |
| PATCH | `/payroll-payments/:id` | `payroll.payment.update` | Edit a still-pending payment |
| PATCH | `/payroll-payments/:id/mark-paid` | `payroll.payment.pay` | Mark a pending payment paid |
| PATCH | `/payroll-payments/:id/cancel` | `payroll.payment.cancel` | Cancel a pending payment (requires `cancelReason`) |

## Request/response shapes worth calling out

`POST /staff`:

```json
{
  "firstName": "Jean",
  "lastName": "Uwimana",
  "memberId": "uuid",
  "position": "senior_pastor",
  "department": "pastoral",
  "employmentType": "full_time",
  "hireDate": "2024-01-15",
  "baseSalary": 500000,
  "salaryCurrency": "RWF"
}
```

`POST /payroll-payments`:

```json
{
  "staffId": "uuid",
  "periodStart": "2026-07-01",
  "periodEnd": "2026-07-31",
  "grossAmount": 500000,
  "deductions": 25000
}
```

`PATCH /payroll-payments/:id/cancel`:

```json
{ "cancelReason": "Duplicate entry — same period paid twice" }
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `STAFF_NOT_FOUND` | 404 | Staff record doesn't exist in this tenant |
| `STAFF_MEMBER_ALREADY_LINKED` | 409 | This member already has an active staff record |
| `PAYROLL_PAYMENT_NOT_FOUND` | 404 | Payment doesn't exist in this tenant |
| `PAYROLL_DEDUCTIONS_EXCEED_GROSS` | 400 | `deductions` is greater than `grossAmount` |
| `PAYROLL_PAYMENT_NOT_PENDING` | 400 | Update/mark-paid/cancel attempted on a payment that isn't `"pending"` |
| `BRANCH_NOT_FOUND` | 404 | (Reused from Module 1) `branchId` doesn't resolve within the tenant |
| `MEMBER_NOT_FOUND` | 404 | (Reused from Module 2) `memberId` doesn't resolve within the tenant |
