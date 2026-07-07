# API Design — Communication

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Notifications (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/notifications` | `communication.notification.create` | Send a notification (email/sms/push) |
| GET | `/notifications` | `communication.notification.read` | Paginated list (`?channel=&status=&memberId=`) |
| GET | `/notifications/:id` | `communication.notification.read` | Get one notification |

## Request/response shapes worth calling out

`POST /notifications` (to a named member, recipient resolved from their profile):

```json
{
  "channel": "sms",
  "memberId": "uuid",
  "body": "Service starts at 9am this Sunday."
}
```

`POST /notifications` (explicit recipient, e.g. an ad-hoc address or a push token):

```json
{
  "channel": "email",
  "recipient": "pastor@demo-church.test",
  "subject": "New prayer request submitted",
  "body": "A member submitted a new prayer request — check the dashboard."
}
```

Response `data` shape (both cases):

```json
{
  "id": "uuid",
  "channel": "sms",
  "recipientMemberId": "uuid",
  "recipient": "+250780000000",
  "subject": null,
  "body": "Service starts at 9am this Sunday.",
  "status": "queued",
  "errorMessage": null,
  "sentAt": null,
  "createdByUserId": "uuid",
  "createdAt": "2026-07-07T21:00:00.000Z"
}
```

`status` transitions to `"sent"` (with `sentAt` populated) or `"failed"` (with `errorMessage`)
asynchronously, once the queue worker processes the job — poll `GET /notifications/:id` to
observe the change.

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `NOTIFICATION_NOT_FOUND` | 404 | Notification doesn't exist in this tenant |
| `NOTIFICATION_RECIPIENT_REQUIRED` | 400 | No `recipient` given, and no `memberId` to resolve one from (or channel is `push`, which never resolves from a member) |
| `NOTIFICATION_RECIPIENT_UNAVAILABLE` | 400 | `memberId` resolved, but that member has no email/phone on file for the requested channel |
| `MEMBER_NOT_FOUND` | 404 | (Reused from Module 2) `memberId` doesn't resolve within the tenant |
