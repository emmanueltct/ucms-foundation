# Functional Requirements — Entity Memberships

## FR-EM-1 Creating a Membership

- FR-EM-1.1 `POST /entity-memberships` (`entity_membership.create`) creates an
  `EntityMembership` with `attachedToEntityType`, `attachedToEntityId`, `memberId`, and
  optionally `role` (default `"member"`) and `joinedAt` (default now).
- FR-EM-1.2 Rejected with `404 MEMBER_NOT_FOUND` unless `memberId` resolves to an
  existing, non-deleted `Member` in the tenant.
- FR-EM-1.3 When `attachedToEntityType` starts with `"dynamicmodule:"`, the referenced
  `DynamicModuleRecord` (parsed `moduleDefinitionId` from the entityType, `id` from
  `attachedToEntityId`) must exist — rejected with `404 ENTITY_MEMBERSHIP_TARGET_NOT_FOUND`
  otherwise. Any other `attachedToEntityType` is not structurally validated.
- FR-EM-1.4 Rejected with `409 ENTITY_MEMBERSHIP_ALREADY_EXISTS` if a membership for the
  same `(attachedToEntityType, attachedToEntityId, memberId)` already exists (enforced by
  a unique constraint, not just application logic).

## FR-EM-2 Reading and Updating

- FR-EM-2.1 `GET /entity-memberships` (`entity_membership.read`) lists memberships,
  paginated, filterable by `attachedToEntityType`/`attachedToEntityId`/`memberId`/`role`.
  `GET /entity-memberships/:id` returns one.
- FR-EM-2.2 `PATCH /entity-memberships/:id` (`entity_membership.update`) may change `role`
  and/or `isActive`. The entity/member being joined cannot be changed — remove and re-add
  to move a membership.
- FR-EM-2.3 `DELETE /entity-memberships/:id` (`entity_membership.delete`) sets
  `isActive: false`; the row is never hard-deleted.

## FR-EM-3 Non-Functional

- FR-EM-3.1 `EntityMembership` is added to the Prisma tenant-scoping extension's
  `TENANT_SCOPED_MODELS` set.
- FR-EM-3.2 New permission codes: `entity_membership.{create,read,update,delete}`.
- FR-EM-3.3 The frontend's `MemberSearchPicker` component (search-existing-members,
  select) is used by the generic Dynamic Module records page's membership panel; it is a
  standalone, reusable component but is not wired into the existing Ministry/Small Group
  roster screens as part of this module.
