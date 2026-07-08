# Functional Requirements — Reports & Analytics

## FR-RPT-1 Overview

- FR-RPT-1.1 `GET /reports/overview` returns, for the caller's tenant: active member count,
  active staff count, branch count, upcoming event count (`startsAt >= now`), sum of
  non-voided contributions received since the start of the current calendar month, and the
  sum of attendance headcounts recorded in the last 30 days.

## FR-RPT-2 Finance Summary

- FR-RPT-2.1 `GET /reports/finance-summary` accepts optional `dateFrom`, `dateTo`, `branchId`.
- FR-RPT-2.2 Returns `byMonth`: one entry per calendar month in the resolved range (see
  FR-RPT-6.1), each with `month` (`YYYY-MM`), `total` (sum of `amount`), `count`.
- FR-RPT-2.3 Returns `byType`: one entry per distinct `contributionType` present in the range,
  each with `key`, `total`, `count`, sorted by `total` descending.
- FR-RPT-2.4 Voided contributions (`isVoided: true`) are always excluded.

## FR-RPT-3 Attendance Trends

- FR-RPT-3.1 `GET /reports/attendance-trends` accepts optional `dateFrom`, `dateTo`, `branchId`.
- FR-RPT-3.2 Returns `byMonth`: one entry per calendar month, each with `month`, `total` (sum
  of `headcount`), `count` (number of records).
- FR-RPT-3.3 Returns `byServiceType`: one entry per distinct `serviceType` present in the
  range, each with `key`, `total`, `count`, sorted by `total` descending.
- FR-RPT-3.4 Soft-deleted attendance records are always excluded.

## FR-RPT-4 Membership Growth

- FR-RPT-4.1 `GET /reports/membership-growth` accepts optional `dateFrom`, `dateTo`,
  `branchId`.
- FR-RPT-4.2 Returns `newMembersByMonth`: one entry per calendar month, each with `month`,
  `total` (members created that month), `count` (same as `total` here), and
  `cumulativeActive` — the running count of non-deleted members created on or before the end
  of that month, seeded from the count of non-deleted members created strictly before the
  range starts.

## FR-RPT-5 Payroll Summary

- FR-RPT-5.1 `GET /reports/payroll-summary` accepts optional `dateFrom`, `dateTo`.
- FR-RPT-5.2 Only `PayrollPayment` rows with `status: "paid"` are included, bucketed by
  `paidAt` (not `periodStart`/`periodEnd`) — a report reflects when money actually left, not
  the period it covers.
- FR-RPT-5.3 Returns `byMonth`: one entry per calendar month, each with `month`, `total` (sum
  of `netAmount`), `count`.
- FR-RPT-5.4 Returns `byDepartment`: one entry per distinct `staff.department` present (an
  unset department groups under the key `"unassigned"`), each with `key`, `total`, `count`,
  sorted by `total` descending.

## FR-RPT-6 Non-Functional

- FR-RPT-6.1 If `dateFrom` is omitted it defaults to the first day of the month 11 months
  before `dateTo`; if `dateTo` is omitted it defaults to now. This yields a trailing-12-month
  window by default across every endpoint in this module.
- FR-RPT-6.2 Every endpoint in this module is guarded by a single permission code,
  `reports.view` — there is no per-report permission.
- FR-RPT-6.3 This module adds no new Prisma models and makes no changes to the tenant-scoping
  extension's `TENANT_SCOPED_MODELS` set — every model it reads was already registered by its
  owning module.
- FR-RPT-6.4 All aggregation is tenant-scoped the same way as every other module — a request
  can never see another tenant's totals.
