# API Design — Events

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Events (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/events` | `event.create` | Create an event (church-wide or scoped to a branch) |
| GET | `/events` | `event.read` | Paginated list (`?branchId=&eventType=&dateFrom=&dateTo=`) |
| GET | `/events/:id` | `event.read` | Get one event |
| PATCH | `/events/:id` | `event.update` | Update an event |
| DELETE | `/events/:id` | `event.delete` | Soft-delete an event and cancel its registrations |

## Event Registrations (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/event-registrations` | `event.registration.create` | Register a member or guest for an event |
| GET | `/event-registrations` | `event.registration.read` | Paginated list (`?eventId=&memberId=&status=`) |
| GET | `/event-registrations/:id` | `event.registration.read` | Get one registration |
| PATCH | `/event-registrations/:id` | `event.registration.update` | Change `status`/`notes` only |
| DELETE | `/event-registrations/:id` | `event.registration.delete` | Cancel (keeps the row for history) |

## Request/response shapes worth calling out

`POST /events`:

```json
{
  "name": "Youth Camp 2026",
  "eventType": "camp",
  "location": "Kigali Convention Centre",
  "startsAt": "2026-08-15T09:00:00.000Z",
  "endsAt": "2026-08-15T17:00:00.000Z",
  "capacity": 200
}
```

`POST /event-registrations` (named member):

```json
{ "eventId": "uuid", "memberId": "uuid" }
```

`POST /event-registrations` (walk-in guest):

```json
{ "eventId": "uuid", "guestName": "Alice Uwase", "guestContact": "+250780000001" }
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `EVENT_NOT_FOUND` | 404 | Event doesn't exist in this tenant |
| `EVENT_REGISTRATION_NOT_FOUND` | 404 | Registration doesn't exist in this tenant |
| `EVENT_REGISTRATION_NAME_REQUIRED` | 400 | Neither `memberId` nor `guestName` was provided |
| `EVENT_REGISTRATION_ALREADY_EXISTS` | 409 | This member is already registered for this event |
| `EVENT_FULL` | 409 | The event's registration capacity has been reached |
| `BRANCH_NOT_FOUND` | 404 | (Reused from Module 1) `branchId` doesn't resolve within the tenant |
| `MEMBER_NOT_FOUND` | 404 | (Reused from Module 2) `memberId` doesn't resolve within the tenant |
