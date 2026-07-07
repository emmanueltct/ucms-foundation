# API Design — Finance

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Contributions (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/contributions` | `finance.contribution.create` | Record a contribution |
| GET | `/contributions` | `finance.contribution.read` | Paginated/filterable list (`?branchId=&memberId=&contributionType=&paymentMethod=&dateFrom=&dateTo=&includeVoided=`) |
| GET | `/contributions/summary` | `finance.contribution.read` | Totals grouped by contribution type for the given filters |
| GET | `/contributions/:id` | `finance.contribution.read` | Get one contribution (voided or not) |
| PATCH | `/contributions/:id` | `finance.contribution.update` | Update `notes`/`receiptNumber` only |
| PATCH | `/contributions/:id/void` | `finance.contribution.void` | Void a contribution (requires `voidReason`) |

## Request/response shapes worth calling out

`POST /contributions`:

```json
{
  "branchId": "uuid",
  "memberId": "uuid",
  "contributionType": "tithe",
  "amount": 25000,
  "currency": "RWF",
  "paymentMethod": "mobile_money",
  "receiptNumber": "RCT-0001",
  "contributedAt": "2026-07-05",
  "notes": null
}
```

`PATCH /contributions/:id/void`:

```json
{ "voidReason": "Duplicate entry — same gift recorded twice" }
```

`GET /contributions/summary` response `data` shape:

```json
[
  { "contributionType": "tithe", "total": "150000", "count": 12 },
  { "contributionType": "offering", "total": "42000", "count": 30 }
]
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `CONTRIBUTION_NOT_FOUND` | 404 | Contribution doesn't exist in this tenant |
| `BRANCH_NOT_FOUND` | 404 | (Reused from Module 1) `branchId` doesn't resolve within the tenant |
| `MEMBER_NOT_FOUND` | 404 | (Reused from Module 2) `memberId` doesn't resolve within the tenant |
| `RECEIPT_NUMBER_TAKEN` | 409 | `receiptNumber` already in use within this tenant |
| `CONTRIBUTION_ALREADY_VOIDED` | 400 | `PATCH /contributions/:id/void` called on a contribution that's already voided |
