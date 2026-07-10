# API Design — Hierarchy Requirements

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Hierarchy Requirements (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/hierarchy-requirements` | `hierarchy_requirement.create` | Define a parent level's requirement of a child level |
| GET | `/hierarchy-requirements` | `hierarchy_requirement.read` | List requirements (`?parentBranchType=&childBranchType=&kind=`) |
| GET | `/hierarchy-requirements/for-branch/:branchId` | `hierarchy_requirement.read` | What this branch's parent level requires of it |
| GET | `/hierarchy-requirements/submissions/branch/:branchId` | `hierarchy_requirement.submission.read` | A branch's own submission history |
| PATCH | `/hierarchy-requirements/submissions/:id/submit` | `hierarchy_requirement.submission.submit` | Mark a submission as submitted |
| PATCH | `/hierarchy-requirements/submissions/:id/approve` | `hierarchy_requirement.submission.decide` | Approve a submitted submission (reason required) |
| PATCH | `/hierarchy-requirements/submissions/:id/reject` | `hierarchy_requirement.submission.decide` | Reject a submitted submission (reason required) |
| GET | `/hierarchy-requirements/:id/submissions` | `hierarchy_requirement.submission.read` | A requirement's full submission history across branches |
| POST | `/hierarchy-requirements/:id/submissions?branchId=` | `hierarchy_requirement.submission.create` | Open a new submission cycle for a branch |
| GET | `/hierarchy-requirements/:id` | `hierarchy_requirement.read` | Get one requirement |
| PATCH | `/hierarchy-requirements/:id` | `hierarchy_requirement.update` | Update a requirement |
| DELETE | `/hierarchy-requirements/:id` | `hierarchy_requirement.delete` | Soft-delete a requirement |

Literal-prefix routes (`for-branch/...`, `submissions/branch/...`, `submissions/:id/...`)
are declared before the plain `:id` CRUD routes — the same ordering rule this project has
used since Reports/Members' `export` vs. `:id` routes.

### Request/response shapes

`POST /hierarchy-requirements`:

```json
{
  "parentBranchType": "diocese",
  "childBranchType": "district",
  "kind": "report",
  "label": "Monthly activity report",
  "frequency": "monthly",
  "notifyRoleNames": ["Bishop"]
}
```

`POST /hierarchy-requirements/:id/submissions?branchId=<uuid>`:

```json
{ "periodLabel": "2026-07" }
```

`PATCH .../submit`:

```json
{ "attachedDocumentIds": ["uuid-of-a-document"], "notes": "Report and photos attached." }
```

`PATCH .../approve` / `.../reject`:

```json
{ "reason": "All figures reconciled with the finance module." }
```

`GET /hierarchy-requirements/:id/submissions` response (`data`, one item):

```json
{
  "id": "uuid",
  "requirementId": "uuid",
  "branchId": "uuid",
  "periodLabel": "2026-07",
  "status": "submitted",
  "attachedDocumentIds": ["uuid"],
  "submittedByUserId": "uuid",
  "submittedAt": "2026-07-10T09:00:00.000Z",
  "notes": "Report and photos attached."
}
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `HIERARCHY_REQUIREMENT_NOT_FOUND` | 404 | Requirement doesn't exist in this tenant |
| `BRANCH_NOT_FOUND` | 404 | Branch doesn't exist in this tenant |
| `BRANCH_TYPE_MISMATCH` | 400 | The branch's type/parent-type don't match the requirement being submitted against |
| `SUBMISSION_ALREADY_EXISTS` | 409 | A submission for this `(requirement, branch, periodLabel)` already exists |
| `SUBMISSION_NOT_FOUND` | 404 | Submission doesn't exist in this tenant |
| `SUBMISSION_ALREADY_SUBMITTED` | 400 | `submit` was called on a submission that isn't `pending` |
| `SUBMISSION_NOT_SUBMITTED` | 400 | `approve`/`reject` was called on a submission that isn't `submitted` |
