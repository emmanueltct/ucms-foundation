/**
 * The bounded set of models with `deletedAt`-based soft-delete that get a
 * unified Trash view + restore action, per the soft-delete/restore plan
 * (Phase 2). Each entry maps a stable, frontend-facing `key` to the Prisma
 * delegate that actually stores the rows, plus the existing permission code
 * its own delete route already uses — restore reuses the same code rather
 * than minting a new one.
 *
 * Deliberately excludes `DynamicModuleRecord`: its rows always live nested
 * under one specific `DynamicModuleDefinition` and are gated by a
 * per-module dynamic permission code (`dynamicmodule.{id}.delete`), not a
 * flat tenant-wide permission — it keeps its own restore route instead (see
 * `dynamic-module-records.service.ts`).
 */
export interface TrashRegistryEntry {
  key: string;
  label: string;
  /** Prisma client property name, e.g. `this.prisma[delegate]`. */
  delegate: string;
  /** Permission code required to view/restore this resource's trash — reused from its existing delete route. */
  permissionCode: string;
  /** Whether restoring should also flip `isActive: true` (every model here except none currently — all have isActive). */
  hasIsActive: boolean;
  /** Restrict returned/restored fields — required for User to avoid leaking passwordHash/mfaSecret. */
  select?: Record<string, boolean>;
}

const USER_SAFE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  isActive: true,
  mfaEnabled: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  deletedAt: true,
  assignedBranchId: true,
};

export const TRASH_REGISTRY: TrashRegistryEntry[] = [
  { key: 'member', label: 'Members', delegate: 'member', permissionCode: 'member.delete', hasIsActive: true },
  { key: 'visitor', label: 'Visitors', delegate: 'visitor', permissionCode: 'visitor.delete', hasIsActive: true },
  { key: 'visitorGroup', label: 'Visitor Groups', delegate: 'visitorGroup', permissionCode: 'visitor_group.delete', hasIsActive: true },
  {
    key: 'dynamicModuleDefinition',
    label: 'Modules',
    delegate: 'dynamicModuleDefinition',
    permissionCode: 'dynamic_module.manage',
    hasIsActive: true,
  },
  { key: 'family', label: 'Families', delegate: 'family', permissionCode: 'family.delete', hasIsActive: true },
  {
    key: 'attendanceRecord',
    label: 'Attendance Records',
    delegate: 'attendanceRecord',
    permissionCode: 'attendance.record.delete',
    hasIsActive: true,
  },
  { key: 'ministry', label: 'Ministries', delegate: 'ministry', permissionCode: 'ministry.delete', hasIsActive: true },
  { key: 'event', label: 'Events', delegate: 'event', permissionCode: 'event.delete', hasIsActive: true },
  { key: 'staff', label: 'Staff', delegate: 'staff', permissionCode: 'staff.delete', hasIsActive: true },
  { key: 'asset', label: 'Assets', delegate: 'asset', permissionCode: 'asset.delete', hasIsActive: true },
  { key: 'document', label: 'Documents', delegate: 'document', permissionCode: 'document.delete', hasIsActive: true },
  { key: 'smallGroup', label: 'Small Groups', delegate: 'smallGroup', permissionCode: 'small_group.delete', hasIsActive: true },
  {
    key: 'hierarchyRequirement',
    label: 'Hierarchy Requirements',
    delegate: 'hierarchyRequirement',
    permissionCode: 'hierarchy_requirement.delete',
    hasIsActive: true,
  },
  { key: 'user', label: 'Users', delegate: 'user', permissionCode: 'user.delete', hasIsActive: true, select: USER_SAFE_SELECT },
  { key: 'branch', label: 'Branches', delegate: 'branch', permissionCode: 'branch.update', hasIsActive: true },
  {
    key: 'customFieldDefinition',
    label: 'Custom Fields',
    delegate: 'customFieldDefinition',
    permissionCode: 'customfield.definition.delete',
    hasIsActive: true,
  },
  {
    key: 'approvalWorkflow',
    label: 'Approval Workflows',
    delegate: 'approvalWorkflow',
    permissionCode: 'approval_workflow.delete',
    hasIsActive: true,
  },
  { key: 'menuItem', label: 'Menu Items', delegate: 'menuItem', permissionCode: 'menu.delete', hasIsActive: true },
  {
    key: 'notificationTemplate',
    label: 'Notification Templates',
    delegate: 'notificationTemplate',
    permissionCode: 'notification_template.delete',
    hasIsActive: true,
  },
];
