# Functional Requirements — Visitor & Follow-up Management

## FR-VIS-1 Recording a Visitor

- FR-VIS-1.1 A tenant can create a `Visitor` with required `firstName`, `lastName`,
  `visitDate`, and optional `branchId`, `visitorGroupId`, `phone`, `email`, `address`,
  `source`, `invitedByMemberId`, `assignedToUserId`, `notes`. `status` always starts `"new"`.
- FR-VIS-1.2 If `branchId` is provided, it must reference an existing, non-deleted branch
  within the same tenant, or the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-VIS-1.3 If `invitedByMemberId` is provided, it must reference an existing, non-deleted
  member within the same tenant, or the request is rejected with `404 MEMBER_NOT_FOUND`.
- FR-VIS-1.4 If `visitorGroupId` is provided, it must reference an existing, non-deleted
  `VisitorGroup` within the same tenant, or the request is rejected with
  `404 VISITOR_GROUP_NOT_FOUND`.

## FR-VIS-2 Listing & Reading

- FR-VIS-2.1 `GET /visitors` returns a paginated list filterable by `branchId`,
  `visitorGroupId`, `status`, `assignedToUserId`, and `search` (matches first name, last name,
  phone, or email, case-insensitive). Soft-deleted visitors are always excluded.
- FR-VIS-2.2 `GET /visitors/:id` returns one visitor.
- FR-VIS-2.3 `GET /visitors/export` accepts the same filters as FR-VIS-2.1 (uncapped, up to
  5000 rows) plus `format` (`csv` | `xlsx` | `pdf`, default `csv`), and returns a downloadable
  file rather than the standard JSON envelope — see
  `docs/reports/functional-requirements.md` FR-RPT-6.3 for the shared export mechanism.

## FR-VIS-3 Updating & Deleting

- FR-VIS-3.1 `PATCH /visitors/:id` may update any field except `id`/`tenantId`. `status` may
  be set to any value except `"joined"`, which is rejected with
  `400 VISITOR_USE_CONVERT_ENDPOINT` (see FR-VIS-4).
- FR-VIS-3.2 `DELETE /visitors/:id` soft-deletes the visitor (`deletedAt`, `isActive=false`).

## FR-VIS-4 Converting to a Member

- FR-VIS-4.1 `PATCH /visitors/:id/convert` accepts a required `memberId`, which must
  reference an existing, non-deleted member within the same tenant
  (`404 MEMBER_NOT_FOUND` otherwise).
- FR-VIS-4.2 If the visitor has already been converted (`convertedMemberId` already set), the
  request is rejected with `400 VISITOR_ALREADY_CONVERTED`.
- FR-VIS-4.3 If the target member is already linked to a different visitor, the request is
  rejected with `409 MEMBER_ALREADY_LINKED_TO_VISITOR`.
- FR-VIS-4.4 On success, `status` is set to `"joined"` and `convertedMemberId` is set to the
  given `memberId`, in one update.

## FR-VIS-5 Visitor Groups

- FR-VIS-5.1 A tenant can create a `VisitorGroup` with required `name`, `groupType`,
  `visitDate`, and optional `branchId`, `contactName`, `contactPhone`, `contactEmail`,
  `expectedSize`, `source`, `assignedToUserId`, `notes`. `status` always starts `"new"` and
  follows the same values as `Visitor.status` minus `"joined"` (a group itself never "joins" —
  see business analysis).
- FR-VIS-5.2 `GET /visitor-groups` returns a paginated list filterable by `branchId`,
  `groupType`, `status`, and `search` (matches name, contact name, phone, or email,
  case-insensitive).
- FR-VIS-5.3 `PATCH /visitor-groups/:id` may update any field except `id`/`tenantId`.
  `DELETE /visitor-groups/:id` soft-deletes the group; its individual `Visitor` members are
  unaffected.
- FR-VIS-5.4 `GET /visitor-groups/:id/members` returns every active `Visitor` whose
  `visitorGroupId` is this group, ordered by first name.

## FR-VIS-6 Configurable Activities

- FR-VIS-6.1 `POST /visitors/:id/activities` and `POST /visitor-groups/:id/activities` each
  create a `VisitorActivity` with required `activityType` (a `ConfigItem` key in namespace
  `visitor_activity_type`), and optional `activityDate` (defaults to now), `outcome`, `notes`,
  and `customFields`. `performedByUserId` is set from the authenticated caller, not
  client-supplied. Exactly one of `visitorId`/`visitorGroupId` is set, matching which endpoint
  was called.
- FR-VIS-6.2 `customFields` is validated against this tenant's Custom Fields definitions for
  entityType `visitor_activity:{activityType}` (required-field and per-type validation reused
  from the Custom Fields module — see FR-VIS-6.4), the same composition Assets uses for
  `asset:{assetCategory}`.
- FR-VIS-6.3 `GET /visitors/:id/activities` and `GET /visitor-groups/:id/activities` return the
  full activity history for that target, most recent first, each with its `customFields`
  attached. There is no update or delete endpoint — a logged activity is permanent history (see
  business analysis).
- FR-VIS-6.4 `assertRequiredFieldsProvided`/`setValues`/`getValuesForMany` from the Custom
  Fields module (Module 9) are reused as-is; this module adds no new custom-field mechanism.

## FR-VIS-7 Non-Functional

- FR-VIS-7.1 All visitor/visitor-group/activity mutations go through the same
  `@Permissions(...)` guard and tenant scoping as every other module.
- FR-VIS-7.2 New permission codes: `visitor.create`, `visitor.read`, `visitor.update`,
  `visitor.delete`, `visitor.convert`, `visitor.activity.create`, `visitor.activity.read`,
  `visitor_group.create`, `visitor_group.read`, `visitor_group.update`, `visitor_group.delete`.
- FR-VIS-7.3 `VisitorGroup`, `Visitor`, and `VisitorActivity` are added to the Prisma
  tenant-scoping extension's `TENANT_SCOPED_MODELS` set.
- FR-VIS-7.4 New `ConfigItem` namespaces: `visitor_source`, `visitor_group_type`,
  `visitor_activity_type`.
