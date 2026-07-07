# API Design — Church & Hierarchy Management

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Branches (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/branches` | `branch.create` | Create a branch (root-level or nested under a parent) |
| GET | `/branches` | `branch.read` | Flat, ordered list (`?includeInactive=true` to include deactivated) |
| GET | `/branches/tree` | `branch.read` | Full hierarchy as a nested tree |
| GET | `/branches/:id` | `branch.read` | Get one branch |
| GET | `/branches/:id/ancestors` | `branch.read` | Ancestor chain, immediate parent first |
| GET | `/branches/:id/descendants` | `branch.read` | All descendants, flattened |
| PATCH | `/branches/:id` | `branch.update` | Rename / change type, code, address, sort order, HQ flag |
| PATCH | `/branches/:id/move` | `branch.move` | Re-parent (or move to root); rejects circular references |
| PATCH | `/branches/:id/deactivate` | `branch.update` | Soft-deactivate this branch and all descendants |
| PATCH | `/branches/:id/reactivate` | `branch.update` | Reactivate only this branch |

## Tenant Profile (tenant-scoped — "my own church", distinct from Platform Admin's `/platform/tenants`)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/tenant` | `tenant.profile.read` | Current user's own tenant profile, including `onboardedAt` |
| PATCH | `/tenant/onboarding/complete` | `tenant.profile.update` | Idempotent final onboarding step (see FR-CH-5.3) |

## Platform Admin — Tenants (extended)

`POST /platform/tenants` (see [../api-design.md](../api-design.md)) now accepts an optional
`adminEmail`. When provided, the response shape is:

```json
{
  "success": true,
  "data": {
    "tenant": { "id": "...", "name": "...", "slug": "...", "onboardedAt": null, "...": "..." },
    "temporaryPassword": "aB3-example-once"
  },
  "meta": null,
  "error": null
}
```

`temporaryPassword` is `null` when `adminEmail` was omitted. It is generated once, hashed
before storage, and never retrievable again — the Platform Admin must relay it to the church
out of band (no email delivery integration yet; see business-analysis.md's "Out of Scope").

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `BRANCH_NOT_FOUND` | 404 | Branch (or referenced parent) doesn't exist in this tenant |
| `BRANCH_CIRCULAR_REFERENCE` | 400 | A move/create would make a branch its own ancestor or parent |
| `TENANT_NOT_FOUND` | 404 | (Reused from Foundation) current tenant profile lookup failed |
