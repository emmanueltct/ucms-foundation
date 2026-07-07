# API Design — Member & Family Management

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Members (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/members` | `member.create` | Create a member profile attached to a branch |
| GET | `/members` | `member.read` | Paginated/searchable list (`?branchId=&familyId=&membershipStatus=&search=`) |
| GET | `/members/:id` | `member.read` | Get one member |
| PATCH | `/members/:id` | `member.update` | Update profile fields (not `branchId`) |
| PATCH | `/members/:id/transfer` | `member.transfer` | Move a member to a different branch |
| DELETE | `/members/:id` | `member.delete` | Soft-delete a member |

## Families (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/families` | `family.create` | Create a family/household |
| GET | `/families` | `family.read` | Paginated/searchable list |
| GET | `/families/:id` | `family.read` | Get one family |
| GET | `/families/:id/members` | `family.read` | List members currently in this family |
| PATCH | `/families/:id` | `family.update` | Update `name`/`address`/`phone`/`notes` |
| PATCH | `/families/:id/head` | `family.update` | Set (or clear) the head of family |
| DELETE | `/families/:id` | `family.delete` | Soft-delete a family (members are not affected) |

## Request/response shapes worth calling out

`POST /members`:

```json
{
  "branchId": "uuid",
  "familyId": "uuid",
  "familyRole": "head",
  "membershipNumber": "MBR-0001",
  "firstName": "Jean",
  "lastName": "Uwimana",
  "gender": "male",
  "dateOfBirth": "1990-04-12",
  "phone": "+250780000000",
  "email": "jean@example.com",
  "address": "KG 7 Ave, Kigali",
  "maritalStatus": "married",
  "membershipCategory": "full_member",
  "membershipStatus": "active",
  "joinedAt": "2020-01-15",
  "baptismDate": "2005-06-01",
  "photoUrl": null,
  "notes": null
}
```

`PATCH /families/:id/head`:

```json
{ "memberId": "uuid" }
```

Omitting `memberId` (or passing `null`) clears the family's head.

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `MEMBER_NOT_FOUND` | 404 | Member doesn't exist in this tenant |
| `FAMILY_NOT_FOUND` | 404 | Family (or referenced `familyId`) doesn't exist in this tenant |
| `BRANCH_NOT_FOUND` | 404 | (Reused from Module 1) `branchId`/transfer target doesn't resolve within the tenant |
| `MEMBERSHIP_NUMBER_TAKEN` | 409 | `membershipNumber` already in use within this tenant |
| `MEMBER_NOT_IN_FAMILY` | 400 | `PATCH /families/:id/head` given a `memberId` not currently pointing at this family |
