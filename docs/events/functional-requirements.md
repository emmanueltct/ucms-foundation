# Functional Requirements — Events

## FR-EVT-1 Creating an Event

- FR-EVT-1.1 A tenant can create an `Event` with required `name`, `startsAt`, and optional
  `branchId`, `eventType`, `description`, `location`, `endsAt`, `capacity`.
- FR-EVT-1.2 If `branchId` is provided, it must reference an existing, non-deleted branch within
  the same tenant, or the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-EVT-1.3 `capacity`, if provided, must be a positive integer.

## FR-EVT-2 Listing & Reading

- FR-EVT-2.1 `GET /events` returns a paginated list filterable by `branchId`, `eventType`, and
  `dateFrom`/`dateTo` (on `startsAt`), following the Foundation module's standard query contract
  (FR-6.1). Soft-deleted events are always excluded.
- FR-EVT-2.2 `GET /events/:id` returns one event.

## FR-EVT-3 Updating & Deleting

- FR-EVT-3.1 `PATCH /events/:id` may update any field except `id`/`tenantId`; changing
  `branchId` re-validates the new branch.
- FR-EVT-3.2 `DELETE /events/:id` soft-deletes the event (`deletedAt`, `isActive=false`) and
  sets every one of its non-cancelled registrations to `status: "cancelled"`.

## FR-EVT-4 Registering

- FR-EVT-4.1 A tenant can create an `EventRegistration` with required `eventId` and either
  `memberId` or `guestName` (at least one), plus optional `guestContact`, `notes`.
- FR-EVT-4.2 `eventId` must reference an existing, non-deleted event within the same tenant, or
  the request is rejected with `404 EVENT_NOT_FOUND`.
- FR-EVT-4.3 If `memberId` is provided, it must reference an existing, non-deleted member within
  the same tenant, or the request is rejected with `404 MEMBER_NOT_FOUND`.
- FR-EVT-4.4 If neither `memberId` nor `guestName` is provided, the request is rejected with
  `400 EVENT_REGISTRATION_NAME_REQUIRED`.
- FR-EVT-4.5 A member cannot register twice for the same event — a duplicate is rejected with
  `409 EVENT_REGISTRATION_ALREADY_EXISTS`. This check does not apply to guest registrations.
- FR-EVT-4.6 If the event has a `capacity` set, a new registration is rejected with
  `409 EVENT_FULL` once the number of non-cancelled registrations for that event reaches it.

## FR-EVT-5 Managing Registrations

- FR-EVT-5.1 `GET /event-registrations` returns a paginated list filterable by `eventId`,
  `memberId`, `status`.
- FR-EVT-5.2 `PATCH /event-registrations/:id` may update `status` (`registered` | `attended` |
  `cancelled`) and/or `notes` only — `eventId`/`memberId` are immutable; cancel and re-register
  to move a registration to a different event.
- FR-EVT-5.3 `DELETE /event-registrations/:id` sets `status: "cancelled"` — the row is never
  hard-deleted.

## FR-EVT-6 Non-Functional

- FR-EVT-6.1 All event/registration mutations go through the same `@Permissions(...)` guard and
  tenant scoping as every other module.
- FR-EVT-6.2 New permission codes: `event.create`, `event.read`, `event.update`, `event.delete`,
  `event.registration.create`, `event.registration.read`, `event.registration.update`,
  `event.registration.delete`.
- FR-EVT-6.3 `Event` and `EventRegistration` are added to the Prisma tenant-scoping extension's
  `TENANT_SCOPED_MODELS` set.
