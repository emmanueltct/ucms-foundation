# Functional Requirements — Communication

## FR-COM-1 Sending a Notification

- FR-COM-1.1 A tenant can create a `Notification` with required `channel` (`email` | `sms` |
  `push`) and `body`, and optional `memberId`, `recipient`, `subject`.
- FR-COM-1.2 If `recipient` is provided, it is used as-is regardless of `memberId`.
- FR-COM-1.3 If `recipient` is omitted and `channel` is `push`, the request is rejected with
  `400 NOTIFICATION_RECIPIENT_REQUIRED` (no device-token registry exists to resolve one).
- FR-COM-1.4 If `recipient` is omitted and `channel` is `email`/`sms`, `memberId` is required —
  omitting both is rejected with `400 NOTIFICATION_RECIPIENT_REQUIRED`.
- FR-COM-1.5 When resolving from `memberId`, the member must exist and be non-deleted within the
  same tenant, or the request is rejected with `404 MEMBER_NOT_FOUND`.
- FR-COM-1.6 When resolving from `memberId`, if the relevant field (`email` for the `email`
  channel, `phone` for `sms`) is empty on that member, the request is rejected with
  `400 NOTIFICATION_RECIPIENT_UNAVAILABLE`.
- FR-COM-1.7 `createdByUserId` is set from the authenticated user making the request; it is not
  an accepted input field.
- FR-COM-1.8 On success, a `Notification` row is created with `status: "queued"` and a job is
  enqueued on the existing `notifications` BullMQ queue before the response is returned.

## FR-COM-2 Delivery Status

- FR-COM-2.1 `NotificationsProcessor` updates the corresponding `Notification.status` to `"sent"`
  (with `sentAt`) on successful processing, or `"failed"` (with `errorMessage`) if processing
  throws — then re-throws, so BullMQ's existing retry/backoff (3 attempts, exponential) still
  applies.
- FR-COM-2.2 Because the processor runs outside any HTTP request, it has no tenant context to
  read implicitly — it passes `tenantId` explicitly in every `where` clause rather than relying
  on the Prisma tenant-scoping extension's automatic injection.

## FR-COM-3 Listing & Reading

- FR-COM-3.1 `GET /notifications` returns a paginated list filterable by `channel`, `status`,
  `memberId`, following the Foundation module's standard query contract (FR-6.1).
- FR-COM-3.2 `GET /notifications/:id` returns one notification.
- FR-COM-3.3 There is no update or delete endpoint — a notification's `status` only ever changes
  via the processor (FR-COM-2.1), and its content is a historical fact once created.

## FR-COM-4 Non-Functional

- FR-COM-4.1 All notification mutations go through the same `@Permissions(...)` guard and tenant
  scoping as every other module.
- FR-COM-4.2 New permission codes introduced by this module: `communication.notification.create`,
  `communication.notification.read`.
- FR-COM-4.3 `Notification` is added to the Prisma tenant-scoping extension's
  `TENANT_SCOPED_MODELS` set, same as every other tenant-owned model.
