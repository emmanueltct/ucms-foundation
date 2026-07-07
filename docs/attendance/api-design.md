# API Design — Attendance

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Attendance Records (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/attendance-records` | `attendance.record.create` | Record attendance (individual check-in or anonymous head-count) |
| GET | `/attendance-records` | `attendance.record.read` | Paginated/filterable list (`?branchId=&memberId=&serviceType=&dateFrom=&dateTo=`) |
| GET | `/attendance-records/summary` | `attendance.record.read` | Totals grouped by service type for the given filters |
| GET | `/attendance-records/:id` | `attendance.record.read` | Get one attendance record |
| PATCH | `/attendance-records/:id` | `attendance.record.update` | Correct any field on a record |
| DELETE | `/attendance-records/:id` | `attendance.record.delete` | Soft-delete a record |

## Request/response shapes worth calling out

`POST /attendance-records` (individual check-in):

```json
{
  "branchId": "uuid",
  "memberId": "uuid",
  "serviceType": "sunday_service",
  "attendanceMethod": "manual",
  "attendedAt": "2026-07-05",
  "notes": null
}
```

`POST /attendance-records` (anonymous head-count):

```json
{
  "branchId": "uuid",
  "serviceType": "sunday_service",
  "headcount": 214,
  "attendedAt": "2026-07-05"
}
```

`GET /attendance-records/summary` response `data` shape:

```json
[
  { "serviceType": "sunday_service", "totalAttendance": 214, "recordCount": 3 },
  { "serviceType": "bible_study", "totalAttendance": 42, "recordCount": 42 }
]
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `ATTENDANCE_RECORD_NOT_FOUND` | 404 | Attendance record doesn't exist in this tenant |
| `ATTENDANCE_HEADCOUNT_REQUIRED` | 400 | `memberId` omitted but no positive `headcount` supplied |
| `ATTENDANCE_ALREADY_RECORDED` | 409 | This member already has a record for this branch/service/date |
| `BRANCH_NOT_FOUND` | 404 | (Reused from Module 1) `branchId` doesn't resolve within the tenant |
| `MEMBER_NOT_FOUND` | 404 | (Reused from Module 2) `memberId` doesn't resolve within the tenant |
