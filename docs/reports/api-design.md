# API Design — Reports & Analytics

Base path: `/api/v1` (same envelope and tenant resolution as the Foundation module — see
[../api-design.md](../api-design.md)). Every endpoint here is read-only (`GET`), so there is
no pagination contract to describe — each returns a complete aggregate for the resolved range.

## Reports (tenant-scoped, all guarded by `reports.view`)

| Method | Path | Description |
|---|---|---|
| GET | `/reports/overview` | Dashboard KPI tiles |
| GET | `/reports/finance-summary` | Contribution totals by month and by type |
| GET | `/reports/attendance-trends` | Attendance totals by month and by service type |
| GET | `/reports/membership-growth` | New members by month + cumulative active count |
| GET | `/reports/payroll-summary` | Paid payroll totals by month and by department |

All four range-based endpoints (everything but `/overview`) accept the same query parameters:

| Param | Required | Description |
|---|---|---|
| `dateFrom` | No | Inclusive lower bound. Defaults to 11 months before `dateTo`. |
| `dateTo` | No | Inclusive upper bound. Defaults to today. |
| `branchId` | No | Restrict to one branch. Ignored by `/payroll-summary` (payroll has no branch dimension of its own beyond `Staff.branchId`, which this module doesn't join through — a future pass could add it if needed). |

## Response shapes

`GET /reports/overview`:

```json
{
  "success": true,
  "data": {
    "members": 482,
    "activeStaff": 12,
    "branches": 6,
    "upcomingEvents": 3,
    "contributionsThisMonth": 1250000,
    "attendanceLast30Days": 2140
  }
}
```

`GET /reports/finance-summary`:

```json
{
  "success": true,
  "data": {
    "byMonth": [
      { "month": "2026-06", "total": 980000, "count": 42 },
      { "month": "2026-07", "total": 1250000, "count": 51 }
    ],
    "byType": [
      { "key": "tithe", "total": 1500000, "count": 60 },
      { "key": "offering", "total": 730000, "count": 33 }
    ]
  }
}
```

`GET /reports/attendance-trends` mirrors the same shape with `byServiceType` in place of
`byType`. `GET /reports/payroll-summary` mirrors it with `byDepartment`.

`GET /reports/membership-growth`:

```json
{
  "success": true,
  "data": {
    "newMembersByMonth": [
      { "month": "2026-06", "total": 8, "count": 8, "cumulativeActive": 474 },
      { "month": "2026-07", "total": 6, "count": 6, "cumulativeActive": 480 }
    ]
  }
}
```

## Error codes introduced by this module

None. Every endpoint is a read-only aggregate over an already-validated tenant context — there
is nothing to reject beyond the standard `400` for a malformed query parameter, already handled
by the global validation pipe.
