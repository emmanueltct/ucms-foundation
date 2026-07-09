# Functional Requirements — Member & Family Management

## FR-MM-1 Member CRUD

- FR-MM-1.1 A tenant can create a `Member` with required `branchId`, `firstName`, `lastName`, and
  optional `familyId`, `familyRole`, `membershipNumber`, `gender`, `dateOfBirth`, `phone`,
  `email`, `address`, `maritalStatus`, `membershipCategory`, `membershipStatus`, `joinedAt`,
  `baptismDate`, `photoUrl`, `notes`.
- FR-MM-1.2 `branchId` must reference an existing, non-deleted branch within the same tenant, or
  the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-MM-1.3 If provided, `familyId` must reference an existing, non-deleted family within the
  same tenant, or the request is rejected with `404 FAMILY_NOT_FOUND`.
- FR-MM-1.4 If provided, `membershipNumber` must be unique within the tenant, or the request is
  rejected with `409 MEMBERSHIP_NUMBER_TAKEN`.
- FR-MM-1.5 `membershipStatus` defaults to `active` and must be one of `active`, `inactive`,
  `transferred`, `deceased`, or the request is rejected with `422` (DTO validation).
- FR-MM-1.6 `GET /members` returns a paginated, searchable (name/email/phone/membership number),
  filterable (`branchId`, `familyId`, `membershipStatus`) list, following the Foundation module's
  standard query contract (FR-6.1).
- FR-MM-1.7 `PATCH /members/:id` may change any field from FR-MM-1.1 **except** `branchId`,
  which only changes via the dedicated transfer endpoint (FR-MM-2).
- FR-MM-1.8 `DELETE /members/:id` soft-deletes the member (`deletedAt` + `isActive=false`); if
  the member was a family's `headOfFamilyId`, that reference is cleared in the same operation
  (FR-MM-3.3).
- FR-MM-1.9 `GET /members/export` accepts the same filters as FR-MM-1.6 (uncapped, up to 5000
  rows) plus `format` (`csv` | `xlsx` | `pdf`, default `csv`), and returns a downloadable file
  rather than the standard JSON envelope — see `docs/reports/functional-requirements.md`
  FR-RPT-6.3 for the shared export mechanism.

## FR-MM-2 Transferring a Member

- FR-MM-2.1 `PATCH /members/:id/transfer` changes a member's `branchId` after verifying the
  target branch exists (and is not deleted) within the same tenant, rejecting with
  `404 BRANCH_NOT_FOUND` otherwise.
- FR-MM-2.2 A transfer does not require the target branch to be `isActive` — a church may
  legitimately record a member as formally attached to a branch that's being wound down.

## FR-MM-3 Family CRUD & Head of Family

- FR-MM-3.1 A tenant can create/read/update a `Family` with a `name` and optional `address`,
  `phone`, `notes`.
- FR-MM-3.2 `PATCH /families/:id/head` sets `headOfFamilyId` to a given `memberId`; the member
  must already have this family's id as its own `familyId`, or the request is rejected with
  `400 MEMBER_NOT_IN_FAMILY`. Passing no `memberId` clears the head.
- FR-MM-3.3 If the member holding `headOfFamilyId` for some family is soft-deleted, or its
  `familyId` is changed away from that family, the family's `headOfFamilyId` is cleared
  automatically in the same operation — never left pointing at a member no longer in the family.
- FR-MM-3.4 `DELETE /families/:id` soft-deletes the family (`deletedAt` + `isActive=false`) but
  does **not** change any member's `familyId` or `isActive` — members keep their historical
  family reference.
- FR-MM-3.5 `GET /families` returns a paginated, searchable (`name`) list; `GET
  /families/:id/members` lists all members currently pointing at that family.

## FR-MM-4 Non-Functional

- FR-MM-4.1 All member/family mutations go through the same `@Permissions(...)` guard and tenant
  scoping (`TenantContextMiddleware` + the Prisma tenant-scoping extension) as every other module
  — no new cross-cutting mechanism is introduced.
- FR-MM-4.2 New permission codes introduced by this module: `member.create`, `member.read`,
  `member.update`, `member.delete`, `member.transfer`, `family.create`, `family.read`,
  `family.update`, `family.delete`.
- FR-MM-4.3 `Member` and `Family` are added to the Prisma tenant-scoping extension's
  `TENANT_SCOPED_MODELS` set, so every query against them is scoped or rejected, same as
  `Branch`.
