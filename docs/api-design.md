# API Design — Foundation Module

Base path: `/api/v1`
Tenant resolution: `X-Tenant-Slug` header (or custom domain / subdomain — see FR-1).
All responses use the standard envelope:

```json
{ "success": true, "data": { ... }, "meta": null, "error": null }
```

or on failure:

```json
{ "success": false, "data": null, "meta": null, "error": { "code": "INVALID_CREDENTIALS", "message": "...", "details": {} } }
```

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public (tenant-scoped) | Create a member/user account within the resolved tenant; also dispatches a verification email |
| POST | `/auth/login` | Public (`X-Tenant-Slug` optional, rate-limited 5/min) | Returns access + refresh token pair, or a workspace list to disambiguate |
| POST | `/auth/switch-tenant` | Access token | Re-issues a session for a different workspace the same email has an account in — no password |
| GET | `/auth/workspaces` | Access token | Lists every workspace the current user's email has an active account in |
| POST | `/auth/forgot-password` | Public (not tenant-scoped, rate-limited 5/min) | Always returns a generic success message |
| POST | `/auth/reset-password` | Public (not tenant-scoped) | Completes a reset using the emailed token |
| POST | `/auth/verify-email` | Public (not tenant-scoped) | Confirms an email using the emailed token |
| POST | `/auth/resend-verification` | Access token | Re-sends the verification email |
| POST | `/auth/refresh` | Refresh token (body) | Rotates refresh token, returns new pair |
| POST | `/auth/logout` | Access token | Revokes the presented refresh token |
| POST | `/auth/logout-all` | Access token | Revokes every refresh token for the user |
| POST | `/auth/mfa/setup` | Access token | Generates a new TOTP secret + QR code (not enforced until confirmed) |
| POST | `/auth/mfa/enable` | Access token | Confirms setup with a code; MFA is enforced on login from then on |
| POST | `/auth/mfa/disable` | Access token | Disables MFA (requires a valid current code) |
| GET | `/auth/sessions` | Access token | Lists the current user's own active device sessions |
| DELETE | `/auth/sessions/:id` | Access token | Revokes one of the current user's own sessions by id |
| GET | `/auth/login-history` | Access token | Last 50 login-related events for the current user |

`login` accepts an optional `mfaCode` field; once MFA is enabled for an account it becomes
required (see `MFA_REQUIRED`/`MFA_INVALID` below). When the same email+password matches more
than one workspace, `login` returns `{ "requiresWorkspaceSelection": true, "workspaces": [{
"slug", "name" }] }` instead of a session — resubmit with `X-Tenant-Slug` set to proceed.

`GET /auth/sessions` response (`data`):

```json
[
  {
    "id": "uuid",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/126.0",
    "ipAddress": "41.203.12.9",
    "createdAt": "2026-07-08T09:00:00.000Z",
    "expiresAt": "2026-07-15T09:00:00.000Z"
  }
]
```

`GET /auth/login-history` response (`data`):

```json
[
  {
    "id": "uuid",
    "action": "auth.login_failed",
    "ipAddress": "41.203.12.9",
    "metadata": { "reason": "invalid_password" },
    "createdAt": "2026-07-09T14:02:00.000Z"
  }
]
```

## Platform Admin — Tenants

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/platform/tenants` | `platform.tenant.create` | Provision a new church |
| GET | `/platform/tenants` | `platform.tenant.read` | List churches (paginated, searchable) |
| GET | `/platform/tenants/:id` | `platform.tenant.read` | Get one church |
| PATCH | `/platform/tenants/:id` | `platform.tenant.update` | Update branding/locale/plan |
| PATCH | `/platform/tenants/:id/deactivate` | `platform.tenant.update` | Suspend a church |
| DELETE | `/platform/tenants/:id` | `platform.tenant.delete` | Soft-delete a church |

## Users

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/users` | `user.create` | Create a user within the current tenant |
| GET | `/users` | `user.read` | List users (paginated, searchable) |
| GET | `/users/:id` | `user.read` | Get one user |
| PATCH | `/users/:id` | `user.update` | Update profile fields |
| PATCH | `/users/:id/roles` | `user.update` | Replace a user's role assignments |
| PATCH | `/users/:id/deactivate` | `user.update` | Disable login |
| DELETE | `/users/:id` | `user.delete` | Soft-delete |

## Roles

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/roles` | `role.create` | Create a tenant-defined role from permission codes |
| GET | `/roles` | `role.read` | List roles with their permissions |
| GET | `/roles/:id` | `role.read` | Get one role |
| PATCH | `/roles/:id` | `role.update` | Rename / change permission set (system roles locked) |
| DELETE | `/roles/:id` | `role.delete` | Delete a custom role (system roles locked) |

## Permissions (global catalog, read-only to tenants)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/permissions?module=finance` | `role.read` | List permission codes, optionally filtered by module |
| GET | `/permissions/modules` | `role.read` | List distinct module names |

## Configuration Engine

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/config/items` | `config.item.create` | Create a namespaced config item |
| GET | `/config/items?namespace=contribution_type` | `config.item.read` | List items in a namespace |
| GET | `/config/items/:id` | `config.item.read` | Get one item |
| PATCH | `/config/items/:id` | `config.item.update` | Update label/value/sortOrder |
| PATCH | `/config/items/:id/deactivate` | `config.item.update` | Soft-disable (never hard-deleted) |
| PATCH | `/config/items/:id/reactivate` | `config.item.update` | Re-enable |
| GET | `/config/features` | `config.feature.read` | List this tenant's feature toggles |
| POST | `/config/features` | `config.feature.update` | Enable/disable a named feature |

## Standard query parameters (list endpoints)

| Param | Type | Description |
|---|---|---|
| `page` | int, default 1 | Page number |
| `pageSize` | int, default 20, max 100 | Items per page |
| `search` | string | Free-text search (endpoint-specific fields) |
| `sortBy` | string | Column to sort by |
| `sortDir` | `asc` \| `desc` | Sort direction |

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `TENANT_NOT_RESOLVED` | 400 | No tenant could be determined from domain/header/subdomain |
| `TENANT_INACTIVE` | 403 | Tenant exists but is suspended/deleted |
| `EMAIL_TAKEN` | 409 | Email already registered within this tenant |
| `INVALID_CREDENTIALS` | 401 | Login failed |
| `USER_INACTIVE` | 401 | Account exists but is disabled |
| `REFRESH_INVALID` | 401 | Refresh token unknown, expired, or already used |
| `TENANT_MISMATCH` | 401 | Access token's tenant doesn't match the resolved tenant |
| `MFA_REQUIRED` | 401 | Account has MFA enabled but `login` was called without `mfaCode` |
| `MFA_INVALID` | 401 / 400 | `mfaCode` (login) or `code` (`/mfa/enable`, `/mfa/disable`) failed verification |
| `NOT_A_MEMBER` | 403 | `switch-tenant` target workspace doesn't have an account for this email |
| `PASSWORD_RESET_TOKEN_INVALID` | 400 | Reset token is unknown, already used, or expired |
| `EMAIL_VERIFICATION_TOKEN_INVALID` | 400 | Verification token is unknown, already used, or expired |
| `SESSION_NOT_FOUND` | 404 | `DELETE /auth/sessions/:id` doesn't resolve to an active session owned by the caller |
| `ROLE_FORBIDDEN` / `PERMISSION_FORBIDDEN` | 403 | RBAC/PBAC check failed |
| `SYSTEM_ROLE_LOCKED` | 403 | Attempted to edit/delete a system role |
| `SLUG_TAKEN` / `ROLE_NAME_TAKEN` / `CONFIG_KEY_TAKEN` | 409 | Uniqueness violation |
| `UNKNOWN_PERMISSION` | 400 | Role references a permission code that doesn't exist |

Every controller and DTO across every module is annotated with `@nestjs/swagger`
decorators, so the full OpenAPI spec (served at `/api/docs`) stays accurate as
new modules ship rather than needing a separate annotation pass.
