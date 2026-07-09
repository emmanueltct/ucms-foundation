# API Design — Member Activities & Personal History

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Member Activities (tenant-scoped, nested under Member & Family Management)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/members/:id/activities` | `member.activity.create` | Log a configurable activity against this member |
| GET | `/members/:id/activities` | `member.activity.read` | List a member's activity history, most recent first |

## Aggregated Report (tenant-scoped, under Reports & Analytics)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/reports/members/:id/activity-history` | `reports.view` | A member's full personal history — ministries, small groups, events, attendance, giving, and activities merged into one timeline |

## Request/response shapes worth calling out

`POST /members/:id/activities`:

```json
{
  "activityType": "certificate_earned",
  "outcome": "Completed the 6-week leadership training with distinction.",
  "customFields": { "certificate_number": "CERT-0012" }
}
```

`customFields` is validated against
`GET /custom-field-definitions?entityType=member_activity:certificate_earned` — see
[../custom-fields/api-design.md](../custom-fields/api-design.md).

`GET /reports/members/:id/activity-history` response (`data`):

```json
{
  "member": { "id": "uuid", "firstName": "Alice", "lastName": "Uwase", "membershipNumber": "M-0042" },
  "ministries": [
    { "ministryId": "uuid", "role": "leader", "joinedAt": "2025-01-10T00:00:00.000Z", "ministry": { "name": "Choir" } }
  ],
  "smallGroups": [
    { "smallGroupId": "uuid", "role": "member", "joinedAt": "2025-03-01T00:00:00.000Z", "smallGroup": { "name": "Youth Cell" } }
  ],
  "eventsAttended": [
    { "eventId": "uuid", "status": "attended", "event": { "name": "Annual Conference", "startsAt": "2026-03-05T09:00:00.000Z" } }
  ],
  "attendance": {
    "totalCount": 40,
    "recent": [{ "serviceType": "sunday_service", "attendedAt": "2026-07-05T09:00:00.000Z", "headcount": 1 }]
  },
  "contributions": {
    "totalAmount": 500000,
    "totalCount": 12,
    "recent": [{ "contributionType": "tithe", "amount": 10000, "currency": "RWF", "contributedAt": "2026-07-01T00:00:00.000Z" }]
  },
  "activities": [
    {
      "id": "uuid",
      "memberId": "uuid",
      "activityType": "baptism",
      "activityDate": "2026-04-01T00:00:00.000Z",
      "outcome": null,
      "notes": null,
      "performedByUserId": "uuid",
      "createdAt": "2026-04-01T00:00:00.000Z",
      "customFields": { "officiant": "Pastor Jean" }
    }
  ],
  "timeline": [
    { "kind": "attendance", "date": "2026-07-05T09:00:00.000Z", "label": "Attended sunday_service" },
    { "kind": "contribution", "date": "2026-07-01T00:00:00.000Z", "label": "Gave (tithe)", "detail": "10000 RWF" },
    { "kind": "activity", "date": "2026-04-01T00:00:00.000Z", "label": "baptism", "detail": null },
    { "kind": "event", "date": "2026-03-05T09:00:00.000Z", "label": "Annual Conference", "detail": "attended" },
    { "kind": "small_group", "date": "2025-03-01T00:00:00.000Z", "label": "Joined Youth Cell", "detail": "member" },
    { "kind": "ministry", "date": "2025-01-10T00:00:00.000Z", "label": "Joined Choir", "detail": "leader" }
  ]
}
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `MEMBER_NOT_FOUND` | 404 | (Reused from Module 2) `id` doesn't resolve to an existing member in this tenant |
| `CUSTOM_FIELD_REQUIRED` / `CUSTOM_FIELD_UNKNOWN` / `CUSTOM_FIELD_INVALID_VALUE` | 400 | (Reused from Module 9) `customFields` failed validation for this `activityType` |
