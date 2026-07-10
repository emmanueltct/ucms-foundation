# Module 18: Entity Memberships — generic membership for Dynamic Module entities

## 1. Business Description

`MinistryMembership` and `SmallGroupMembership` already implement the requirement "a
person must be a registered member before joining any entity, never duplicated as a new
record" — correctly, and specifically for Ministries and Small Groups. This module
generalizes that same shape (`Member` + role, attached to something) into a reusable
mechanism for the one place it didn't already exist: entities built through the Dynamic
Module Builder (Module 17), e.g. a "Fellowship" or "Committee" that a tenant defined
themselves, with no dedicated schema of its own.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).

| Actor | Relevance to this module |
|---|---|
| Leader (of a Dynamic Module entity, e.g. a Fellowship) | Searches for and adds an existing Member with a role; never creates a new Member here |
| Church Administrator | Grants `entity_membership.*` permissions the same way as any other permission |

## 3. Key Business Rules

- **`EntityMembership` generalizes, it does not replace.** `MinistryMembership` and
  `SmallGroupMembership` are left exactly as they are — no data migration, no behavior
  change to either existing screen. `EntityMembership` only covers entities that have no
  dedicated membership table of their own, which today means Dynamic Module entities.
- **A membership always references an existing `Member` — this module never creates
  one.** `EntityMembershipsService.create` validates `memberId` resolves to a real,
  non-deleted `Member` in the tenant before anything else; the frontend's shared
  `MemberSearchPicker` component (search-by-name, select) is the only way to choose one,
  never a free-text name field.
- **The target entity is only structurally validated for the Dynamic Module case.**
  `attachedToEntityType`/`attachedToEntityId` are free-form strings, the same as every
  other composed-entityType pair in this platform — there is no universal entity
  registry to check an arbitrary entityType against. When `attachedToEntityType` starts
  with `"dynamicmodule:"`, the referenced `DynamicModuleRecord` is looked up and must
  exist; any other entityType is trusted as given (the same trust level
  `DynamicModuleRecord.attachedToEntityType`/`attachedToEntityId` themselves already
  carry).
- **Removing a membership deactivates it, mirroring `MinistryMembership`'s own
  non-cascading-delete philosophy.** The row stays for history; `isActive: false` is what
  "removed" means, not a deleted row.
- **The shared `MemberSearchPicker` frontend component is additive, not a forced
  rewrite.** It's used by the new generic membership panel on
  `/admin/modules/[key]`; the two existing Ministry/Small Group roster screens keep their
  own inline `<select>` of members, since neither needed to change for this module to
  ship and rewriting working screens for consistency alone wasn't asked for.

## 4. Out of Scope for This Module

- **Migrating `MinistryMembership`/`SmallGroupMembership` onto this generic table** — they
  already satisfy the underlying requirement as built; migrating live data for
  consistency's own sake was never asked for and would be a pure risk with no functional
  gain.
- **Structural validation of non-Dynamic-Module entity types** — see the rule above. A
  future generic entity registry, if one is ever built, could close this gap; it isn't
  needed for what this module was asked to cover.
- **Backfilling `MemberSearchPicker` into the existing Ministry/Small Group screens** —
  optional per the original plan, left undone since it's a cosmetic consistency pass, not
  a functional requirement, and neither existing screen has a reported usability problem
  with its current inline `<select>`.
