# Module 6: Communication

## 1. Business Description

Every module built so far generates things a church needs to tell someone about — a contribution
receipt, a service reminder, a volunteer request. This module is the one place that actually
sends messages (email, SMS, push) and keeps a durable record of what was sent, to whom, and
whether it succeeded — the first real consumer of the `QueueModule`/BullMQ pipeline the
Foundation module scaffolded specifically for this purpose.

This is Module 6 — it builds on the Foundation module (Module 0)'s queue infrastructure and the
Member & Family module (Module 2)'s members (whose `email`/`phone` fields become notification
recipients). It does not depend on Finance, Attendance, or Ministry.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator / Ministry Leader | Sends notifications and reviews delivery history |
| Member | The (usually) recipient — reached via their profile's `email`/`phone`, or an explicit address |

## 3. Key Business Rules

- **A `Notification` is a durable record, not just a fire-and-forget action.** Every send creates
  a row before anything is dispatched, with a `status` (`queued` → `sent` | `failed`) that the
  queue worker updates once the (stubbed) delivery attempt completes — so "did this actually go
  out" is always answerable from the database, not just from logs.
- **Dispatch is asynchronous, via the existing queue, never synchronous in the request path.**
  `NotificationsService.create` enqueues through the same `QueueService`/`NotificationsProcessor`
  built in the Foundation module's infra pass — a slow or flaky gateway can never block the HTTP
  request that triggered a send. This module is the first to actually exercise that pipeline.
- **Recipient resolution has one clear precedence: explicit wins, then the named member's profile,
  then failure.** An explicit `recipient` (address/token) always wins if provided. Otherwise, for
  `email`/`sms`, the recipient is resolved from `Member.email`/`Member.phone` — if that field is
  empty, the request fails loudly (`NOTIFICATION_RECIPIENT_UNAVAILABLE`) rather than silently
  sending nowhere. `push` has no resolution path at all yet (see Out of Scope) and always requires
  an explicit recipient.
- **The recipient is captured as a concrete value at send time, not re-resolved later.**
  `Notification.recipient` stores the actual address/token used, independent of
  `recipientMemberId` — so a notification's history stays accurate even if the member's contact
  info changes afterward, the same reasoning `Contribution.currency` already established for
  "capture a fact at the time it happened, don't make history float."
- **Email delivery is real once SMTP credentials are configured; SMS/push remain a documented
  stub.** `NotificationsProcessor` sends a real message via `nodemailer` for `channel: "email"`
  whenever `SMTP_HOST` is set (see `.env.example`) — any standard SMTP provider works (Gmail, SES
  SMTP, SendGrid SMTP, Mailgun, a church's own mail server). Without `SMTP_HOST` configured, email
  falls back to the original log-and-mark-sent stub, so a fresh checkout with no mail credentials
  keeps working exactly as before. SMS and push still have no equivalent gateway credentials in
  this environment (no MTN-style/Twilio/FCM account), so those two channels always use the stub.
  This mirrors the Foundation module's precedent for Finance's payment-gateway integration and
  Module 1's onboarding-password delivery: the *pipeline* is real and fully wired; the last-mile
  dispatch is swappable per channel, and email's is now swapped in.

## 4. Out of Scope for This Module

- **Real SMS/push gateway integration** (MTN MoMo/Airtel-style SMS, FCM/APNs push) — email's
  dispatch seam in `NotificationsProcessor.process` is now real; SMS/push are the same
  intentional seam, just not yet wired to a provider (no credentials available in this
  environment).
- **Push device-token registry** — there's no `DeviceToken` model yet tying a member to their
  phone's push token, so `channel: "push"` always requires an explicit `recipient` today. A
  future Mobile API module registering tokens per member/device would let push resolve the same
  way email/sms already do.
- **Templates** — `subject`/`body` are always supplied by the caller as plain strings; a reusable
  template system (e.g. "service reminder" with placeholders) is a UI/convenience layer on top of
  this module's `POST /notifications`, not a prerequisite for it.
- **Bulk/broadcast sending** (e.g. "notify everyone in this branch") — this module sends one
  notification per request; a bulk-send feature would loop over members and call this module's
  `create` once per recipient, no new primitive required here.
- **Prayer Requests and Counseling** — the PDF groups these near Communication, but they're
  member-submitted *requests* with their own workflow/state, not outbound messages; they belong
  to a separate module that may itself use this one to notify a pastor of a new request.
