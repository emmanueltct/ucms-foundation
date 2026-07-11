import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Foundation-module permission codes. Every later module (Finance,
 * Membership, Attendance, ...) appends its own codes here via a new
 * migration/seed step — this list never needs to change retroactively.
 */
const FOUNDATION_PERMISSIONS: Array<{ code: string; module: string; description: string }> = [
  { code: 'platform.tenant.create', module: 'platform', description: 'Provision a new church tenant' },
  { code: 'platform.tenant.read', module: 'platform', description: 'View church tenants' },
  { code: 'platform.tenant.update', module: 'platform', description: 'Edit church tenant settings' },
  { code: 'platform.tenant.delete', module: 'platform', description: 'Deactivate/delete a church tenant' },

  { code: 'user.create', module: 'user', description: 'Invite/create users within the church' },
  { code: 'user.read', module: 'user', description: 'View users within the church' },
  { code: 'user.update', module: 'user', description: 'Edit users and assign roles' },
  { code: 'user.delete', module: 'user', description: 'Deactivate/remove users' },

  { code: 'role.create', module: 'role', description: 'Create custom roles' },
  { code: 'role.read', module: 'role', description: 'View roles and the permission catalog' },
  { code: 'role.update', module: 'role', description: 'Edit role permissions' },
  { code: 'role.delete', module: 'role', description: 'Delete custom roles' },

  { code: 'config.item.create', module: 'config', description: 'Create configuration items (ministries, categories, etc.)' },
  { code: 'config.item.read', module: 'config', description: 'View configuration items' },
  { code: 'config.item.update', module: 'config', description: 'Edit/deactivate configuration items' },
  { code: 'config.feature.read', module: 'config', description: 'View feature toggles' },
  { code: 'config.feature.update', module: 'config', description: 'Enable/disable features' },

  { code: 'branch.create', module: 'branch', description: 'Create branches within the church hierarchy' },
  { code: 'branch.read', module: 'branch', description: 'View branches and the hierarchy tree' },
  { code: 'branch.update', module: 'branch', description: 'Edit, deactivate, or reactivate a branch' },
  { code: 'branch.move', module: 'branch', description: "Re-parent a branch within the hierarchy" },

  { code: 'tenant.profile.read', module: 'tenant', description: "View the current user's own church profile" },
  { code: 'tenant.profile.update', module: 'tenant', description: "Update the current church's profile / complete onboarding" },

  { code: 'member.create', module: 'member', description: 'Create member profiles' },
  { code: 'member.read', module: 'member', description: 'View member profiles' },
  { code: 'member.update', module: 'member', description: 'Edit member profiles' },
  { code: 'member.delete', module: 'member', description: 'Soft-delete a member profile' },
  { code: 'member.transfer', module: 'member', description: 'Move a member to a different branch' },
  { code: 'member.registration.decide', module: 'member', description: 'Approve or reject a pending self/admin registration' },
  { code: 'member.activity.create', module: 'member', description: 'Log an activity (sacrament, training, certificate, leadership appointment, ...) against a member' },
  { code: 'member.activity.read', module: 'member', description: "View a member's logged activity history" },

  { code: 'family.create', module: 'family', description: 'Create families/households' },
  { code: 'family.read', module: 'family', description: 'View families and their members' },
  { code: 'family.update', module: 'family', description: 'Edit a family and set/clear its head' },
  { code: 'family.delete', module: 'family', description: 'Soft-delete a family' },

  { code: 'finance.contribution.create', module: 'finance', description: 'Record a contribution' },
  { code: 'finance.contribution.read', module: 'finance', description: 'View contributions and summaries' },
  { code: 'finance.contribution.update', module: 'finance', description: 'Edit a contribution\'s notes/receipt number' },
  { code: 'finance.contribution.void', module: 'finance', description: 'Void a contribution' },

  { code: 'attendance.record.create', module: 'attendance', description: 'Record attendance' },
  { code: 'attendance.record.read', module: 'attendance', description: 'View attendance records and summaries' },
  { code: 'attendance.record.update', module: 'attendance', description: 'Correct an attendance record' },
  { code: 'attendance.record.delete', module: 'attendance', description: 'Soft-delete an attendance record' },

  { code: 'ministry.create', module: 'ministry', description: 'Create a ministry' },
  { code: 'ministry.read', module: 'ministry', description: 'View ministries' },
  { code: 'ministry.update', module: 'ministry', description: 'Edit a ministry' },
  { code: 'ministry.delete', module: 'ministry', description: 'Soft-delete a ministry' },
  { code: 'ministry.membership.create', module: 'ministry', description: 'Add a member to a ministry' },
  { code: 'ministry.membership.read', module: 'ministry', description: 'View ministry memberships' },
  { code: 'ministry.membership.update', module: 'ministry', description: "Change a member's role within a ministry" },
  { code: 'ministry.membership.delete', module: 'ministry', description: 'Remove a member from a ministry' },

  { code: 'communication.notification.create', module: 'communication', description: 'Send a notification (email/sms/push)' },
  { code: 'communication.notification.read', module: 'communication', description: 'View notification history' },

  { code: 'customfield.definition.create', module: 'customfield', description: 'Define a new custom field on an entity' },
  { code: 'customfield.definition.read', module: 'customfield', description: 'View custom field definitions' },
  { code: 'customfield.definition.update', module: 'customfield', description: 'Edit or reactivate a custom field definition' },
  { code: 'customfield.definition.delete', module: 'customfield', description: 'Retire a custom field definition' },

  { code: 'event.create', module: 'event', description: 'Create an event' },
  { code: 'event.read', module: 'event', description: 'View events' },
  { code: 'event.update', module: 'event', description: 'Edit an event' },
  { code: 'event.delete', module: 'event', description: 'Soft-delete an event' },
  { code: 'event.registration.create', module: 'event', description: 'Register a member or guest for an event' },
  { code: 'event.registration.read', module: 'event', description: 'View event registrations' },
  { code: 'event.registration.update', module: 'event', description: "Change a registration's status/notes" },
  { code: 'event.registration.delete', module: 'event', description: 'Cancel a registration' },

  { code: 'staff.create', module: 'staff', description: 'Create a staff (HR) record' },
  { code: 'staff.read', module: 'staff', description: 'View staff records' },
  { code: 'staff.update', module: 'staff', description: 'Edit a staff record' },
  { code: 'staff.delete', module: 'staff', description: 'Soft-delete a staff record' },

  { code: 'payroll.payment.create', module: 'payroll', description: 'Create a pending payroll payment' },
  { code: 'payroll.payment.read', module: 'payroll', description: 'View payroll payments' },
  { code: 'payroll.payment.update', module: 'payroll', description: 'Edit a still-pending payroll payment' },
  { code: 'payroll.payment.pay', module: 'payroll', description: 'Mark a payroll payment as paid' },
  { code: 'payroll.payment.cancel', module: 'payroll', description: 'Cancel a pending payroll payment' },

  { code: 'reports.view', module: 'reports', description: 'View cross-module reports and analytics' },

  { code: 'asset.create', module: 'asset', description: 'Register a new asset' },
  { code: 'asset.read', module: 'asset', description: 'View assets and their documents' },
  { code: 'asset.update', module: 'asset', description: 'Edit an asset and upload its documents' },
  { code: 'asset.delete', module: 'asset', description: 'Soft-delete an asset' },

  { code: 'visitor.create', module: 'visitor', description: 'Record a first-time visitor' },
  { code: 'visitor.read', module: 'visitor', description: 'View visitors and their activity history' },
  { code: 'visitor.update', module: 'visitor', description: 'Edit a visitor and change their follow-up status' },
  { code: 'visitor.delete', module: 'visitor', description: 'Soft-delete a visitor' },
  { code: 'visitor.convert', module: 'visitor', description: 'Link a visitor to a member and mark them joined' },
  { code: 'visitor.activity.create', module: 'visitor', description: 'Log an activity (visit, class, prayer, follow-up, ...) against a visitor or visitor group' },
  { code: 'visitor.activity.read', module: 'visitor', description: "View a visitor's or visitor group's activity history" },
  { code: 'visitor_group.create', module: 'visitor', description: 'Record a visiting group (family, delegation, choir visit, mission team, ...)' },
  { code: 'visitor_group.read', module: 'visitor', description: 'View visitor groups and their members' },
  { code: 'visitor_group.update', module: 'visitor', description: 'Edit a visitor group' },
  { code: 'visitor_group.delete', module: 'visitor', description: 'Soft-delete a visitor group' },

  { code: 'document.create', module: 'document', description: 'Upload a document' },
  { code: 'document.read', module: 'document', description: 'View and download documents' },
  { code: 'document.update', module: 'document', description: "Edit a document's metadata or replace its file" },
  { code: 'document.delete', module: 'document', description: 'Soft-delete a document' },

  { code: 'small_group.create', module: 'small_group', description: 'Create a small group or children\'s ministry class' },
  { code: 'small_group.read', module: 'small_group', description: 'View small groups' },
  { code: 'small_group.update', module: 'small_group', description: 'Edit a small group' },
  { code: 'small_group.delete', module: 'small_group', description: 'Soft-delete a small group' },
  { code: 'small_group.membership.create', module: 'small_group', description: 'Add a member to a small group' },
  { code: 'small_group.membership.read', module: 'small_group', description: 'View small group rosters' },
  { code: 'small_group.membership.update', module: 'small_group', description: "Change a member's role within a small group" },
  { code: 'small_group.membership.delete', module: 'small_group', description: 'Remove a member from a small group' },

  { code: 'approval_workflow.create', module: 'governance', description: 'Define an approval workflow' },
  { code: 'approval_workflow.read', module: 'governance', description: 'View approval workflows and requests' },
  { code: 'approval_workflow.update', module: 'governance', description: 'Rename or activate/deactivate an approval workflow' },
  { code: 'approval_workflow.delete', module: 'governance', description: 'Delete a workflow with no approval history yet' },
  { code: 'approval_workflow.decide', module: 'governance', description: 'Approve or reject a pending approval request' },
  { code: 'deadline.create', module: 'governance', description: 'Set a deadline against a record' },
  { code: 'deadline.read', module: 'governance', description: 'View a deadline and its status' },
  { code: 'deadline.extend', module: 'governance', description: 'Push a locked (overdue) deadline forward' },
  { code: 'deadline.close', module: 'governance', description: 'Close a deadline, preventing further edits' },
  { code: 'deadline.reopen', module: 'governance', description: 'Reopen a closed deadline — a more sensitive action than close' },
  { code: 'audit.read', module: 'governance', description: 'View the audit log (who changed what, when, and why)' },

  { code: 'menu.create', module: 'menu', description: 'Create a navigation menu item' },
  { code: 'menu.read', module: 'menu', description: 'View configured menu items' },
  { code: 'menu.update', module: 'menu', description: 'Edit or reorder a menu item' },
  { code: 'menu.delete', module: 'menu', description: 'Delete a menu item' },

  { code: 'notification_template.create', module: 'notification_template', description: 'Create a reusable notification template' },
  { code: 'notification_template.read', module: 'notification_template', description: 'View notification templates' },
  { code: 'notification_template.update', module: 'notification_template', description: 'Edit or retire a notification template' },
  { code: 'notification_template.delete', module: 'notification_template', description: 'Delete a notification template' },

  { code: 'numbering_sequence.create', module: 'numbering_sequence', description: 'Create a numbering sequence' },
  { code: 'numbering_sequence.read', module: 'numbering_sequence', description: 'View numbering sequences' },
  { code: 'numbering_sequence.update', module: 'numbering_sequence', description: 'Edit a numbering sequence' },
  { code: 'numbering_sequence.delete', module: 'numbering_sequence', description: 'Delete a numbering sequence' },

  { code: 'hierarchy_requirement.create', module: 'governance', description: "Define a parent level's requirement of a child level" },
  { code: 'hierarchy_requirement.read', module: 'governance', description: 'View hierarchy requirements' },
  { code: 'hierarchy_requirement.update', module: 'governance', description: 'Edit a hierarchy requirement' },
  { code: 'hierarchy_requirement.delete', module: 'governance', description: 'Deactivate a hierarchy requirement' },
  { code: 'hierarchy_requirement.submission.create', module: 'governance', description: 'Open a new submission cycle for a branch' },
  { code: 'hierarchy_requirement.submission.read', module: 'governance', description: 'View requirement submissions' },
  { code: 'hierarchy_requirement.submission.submit', module: 'governance', description: 'Mark a submission as submitted' },
  { code: 'hierarchy_requirement.submission.decide', module: 'governance', description: 'Approve or reject a submitted submission' },

  { code: 'dynamic_module.manage', module: 'dynamic_modules', description: 'Create, edit, and deactivate admin-defined modules' },
  { code: 'dynamic_module.read', module: 'dynamic_modules', description: 'View admin-defined module definitions' },

  { code: 'entity_membership.create', module: 'entity_memberships', description: 'Add an existing member to an entity (e.g. a Dynamic Module record)' },
  { code: 'entity_membership.read', module: 'entity_memberships', description: 'View entity memberships' },
  { code: 'entity_membership.update', module: 'entity_memberships', description: "Change a member's role or active status within an entity" },
  { code: 'entity_membership.delete', module: 'entity_memberships', description: 'Remove a member from an entity' },
];

async function main() {
  console.log('Seeding permission catalog...');
  for (const perm of FOUNDATION_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      create: perm,
      update: { module: perm.module, description: perm.description },
    });
  }

  console.log('Seeding platform admin...');
  const platformAdminPasswordHash = await bcrypt.hash('ChangeMe123', 12);
  await prisma.platformAdmin.upsert({
    where: { email: 'platform-admin@ucms.app' },
    create: {
      email: 'platform-admin@ucms.app',
      passwordHash: platformAdminPasswordHash,
      firstName: 'Platform',
      lastName: 'Admin',
    },
    update: {},
  });

  console.log('Seeding demo tenant...');
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-church' },
    create: {
      name: 'Demo Church',
      slug: 'demo-church',
      currency: 'RWF',
      language: 'en',
      timezone: 'Africa/Kigali',
      subscriptionPlan: 'growth',
    },
    update: {},
  });

  const allPermissions = await prisma.permission.findMany();

  const adminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Church Administrator' } },
    create: {
      tenantId: tenant.id,
      name: 'Church Administrator',
      description: 'Full access within this church tenant',
      isSystem: true,
      rolePermissions: { create: allPermissions.map((p) => ({ permissionId: p.id })) },
    },
    update: {},
  });

  // Keep the demo admin role in sync with every permission added by later modules
  // (upsert's `update: {}` above only touches the role's own fields, not its links).
  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  const passwordHash = await bcrypt.hash('ChangeMe123', 12);
  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo-church.test' } },
    create: {
      tenantId: tenant.id,
      email: 'admin@demo-church.test',
      passwordHash,
      firstName: 'Demo',
      lastName: 'Admin',
      // Pre-verified: the email gateway is a documented stub (see Communication
      // module), so a real verification link never actually arrives for the demo
      // account — this avoids a permanent, unactionable "verify your email" nudge.
      emailVerifiedAt: new Date(),
      userRoles: { create: [{ roleId: adminRole.id }] },
    },
    update: { emailVerifiedAt: new Date() },
  });

  console.log('Seeding example configuration items (contribution types)...');
  const contributionTypes = [
    { key: 'tithe', label: 'Tithe' },
    { key: 'offering', label: 'Offering' },
    { key: 'building_fund', label: 'Building Fund' },
  ];
  for (const [i, ct] of contributionTypes.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'contribution_type', key: ct.key } },
      create: { tenantId: tenant.id, namespace: 'contribution_type', key: ct.key, label: ct.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (branch types)...');
  const branchTypes = [
    { key: 'headquarters', label: 'Headquarters' },
    { key: 'parish', label: 'Parish' },
    { key: 'district', label: 'District' },
    { key: 'cell', label: 'Cell / Home Group' },
  ];
  for (const [i, bt] of branchTypes.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'branch_type', key: bt.key } },
      create: { tenantId: tenant.id, namespace: 'branch_type', key: bt.key, label: bt.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (membership categories)...');
  const membershipCategories = [
    { key: 'full_member', label: 'Full Member' },
    { key: 'associate', label: 'Associate Member' },
    { key: 'visitor', label: 'Visitor' },
  ];
  for (const [i, mc] of membershipCategories.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'membership_category', key: mc.key } },
      create: { tenantId: tenant.id, namespace: 'membership_category', key: mc.key, label: mc.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (member activity types)...');
  const memberActivityTypes = [
    { key: 'baptism', label: 'Baptism' },
    { key: 'communion', label: 'First Communion' },
    { key: 'confirmation', label: 'Confirmation' },
    { key: 'marriage', label: 'Marriage' },
    { key: 'training_completed', label: 'Training Completed' },
    { key: 'certificate_earned', label: 'Certificate Earned' },
    { key: 'leadership_appointment', label: 'Leadership Appointment' },
    { key: 'volunteer_work', label: 'Volunteer Work' },
    { key: 'counseling', label: 'Counseling' },
  ];
  for (const [i, a] of memberActivityTypes.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'member_activity_type', key: a.key } },
      create: { tenantId: tenant.id, namespace: 'member_activity_type', key: a.key, label: a.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (service types)...');
  const serviceTypes = [
    { key: 'sunday_service', label: 'Sunday Service' },
    { key: 'bible_study', label: 'Bible Study' },
    { key: 'prayer_meeting', label: 'Prayer Meeting' },
    { key: 'youth_service', label: 'Youth Service' },
  ];
  for (const [i, st] of serviceTypes.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'service_type', key: st.key } },
      create: { tenantId: tenant.id, namespace: 'service_type', key: st.key, label: st.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (attendance methods)...');
  const attendanceMethods = [
    { key: 'manual', label: 'Manual Roll Call' },
    { key: 'qr_checkin', label: 'QR Check-in' },
    { key: 'self_checkin', label: 'Self Check-in (Mobile App)' },
  ];
  for (const [i, am] of attendanceMethods.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'attendance_method', key: am.key } },
      create: { tenantId: tenant.id, namespace: 'attendance_method', key: am.key, label: am.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (ministry types)...');
  const ministryTypes = [
    { key: 'youth', label: 'Youth Ministry' },
    { key: 'choir', label: 'Choir / Worship Team' },
    { key: 'ushering', label: 'Ushering' },
    { key: 'missions', label: 'Missions & Outreach' },
  ];
  for (const [i, mt] of ministryTypes.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'ministry_type', key: mt.key } },
      create: { tenantId: tenant.id, namespace: 'ministry_type', key: mt.key, label: mt.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (event types)...');
  const eventTypes = [
    { key: 'conference', label: 'Conference' },
    { key: 'camp', label: 'Camp / Retreat' },
    { key: 'outreach', label: 'Outreach' },
    { key: 'social', label: 'Social / Fellowship' },
  ];
  for (const [i, et] of eventTypes.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'event_type', key: et.key } },
      create: { tenantId: tenant.id, namespace: 'event_type', key: et.key, label: et.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (staff positions)...');
  const staffPositions = [
    { key: 'senior_pastor', label: 'Senior Pastor' },
    { key: 'associate_pastor', label: 'Associate Pastor' },
    { key: 'administrator', label: 'Church Administrator' },
    { key: 'accountant', label: 'Accountant' },
    { key: 'facilities', label: 'Facilities / Caretaker' },
  ];
  for (const [i, sp] of staffPositions.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'staff_position', key: sp.key } },
      create: { tenantId: tenant.id, namespace: 'staff_position', key: sp.key, label: sp.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (departments)...');
  const departments = [
    { key: 'pastoral', label: 'Pastoral' },
    { key: 'administration', label: 'Administration' },
    { key: 'finance', label: 'Finance' },
    { key: 'facilities', label: 'Facilities' },
  ];
  for (const [i, d] of departments.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'department', key: d.key } },
      create: { tenantId: tenant.id, namespace: 'department', key: d.key, label: d.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (asset categories)...');
  const assetCategories = [
    { key: 'building', label: 'Building' },
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'furniture', label: 'Furniture' },
    { key: 'electronics', label: 'Electronics' },
    { key: 'land', label: 'Land' },
  ];
  for (const [i, c] of assetCategories.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'asset_category', key: c.key } },
      create: { tenantId: tenant.id, namespace: 'asset_category', key: c.key, label: c.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (asset conditions)...');
  const assetConditions = [
    { key: 'excellent', label: 'Excellent' },
    { key: 'good', label: 'Good' },
    { key: 'fair', label: 'Fair' },
    { key: 'poor', label: 'Poor' },
    { key: 'damaged', label: 'Damaged' },
  ];
  for (const [i, c] of assetConditions.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'asset_condition', key: c.key } },
      create: { tenantId: tenant.id, namespace: 'asset_condition', key: c.key, label: c.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (visitor sources)...');
  const visitorSources = [
    { key: 'friend_family', label: 'Friend / Family' },
    { key: 'social_media', label: 'Social Media' },
    { key: 'walk_in', label: 'Walk-in' },
    { key: 'event', label: 'Event' },
    { key: 'outreach', label: 'Outreach' },
    { key: 'other', label: 'Other' },
  ];
  for (const [i, s] of visitorSources.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'visitor_source', key: s.key } },
      create: { tenantId: tenant.id, namespace: 'visitor_source', key: s.key, label: s.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (visitor group types)...');
  const visitorGroupTypes = [
    { key: 'family', label: 'Family' },
    { key: 'delegation', label: 'Delegation' },
    { key: 'choir_visit', label: 'Choir Visit' },
    { key: 'youth_visit', label: 'Youth Group Visit' },
    { key: 'ministry_visit', label: 'Ministry Visit' },
    { key: 'conference_visitors', label: 'Conference Visitors' },
    { key: 'mission_team', label: 'Mission Team' },
  ];
  for (const [i, g] of visitorGroupTypes.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'visitor_group_type', key: g.key } },
      create: { tenantId: tenant.id, namespace: 'visitor_group_type', key: g.key, label: g.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (visitor activity types)...');
  const visitorActivityTypes = [
    { key: 'first_visit', label: 'First Visit' },
    { key: 'follow_up', label: 'Follow-up' },
    { key: 'counseling', label: 'Counseling' },
    { key: 'prayer', label: 'Prayer' },
    { key: 'evangelism', label: 'Evangelism' },
    { key: 'home_visit', label: 'Home Visit' },
    { key: 'baptism_class', label: 'Baptism Class' },
    { key: 'marriage_class', label: 'Marriage Class' },
    { key: 'deliverance', label: 'Deliverance' },
    { key: 'bible_study', label: 'Bible Study' },
    { key: 'outreach', label: 'Outreach' },
    { key: 'conference', label: 'Conference' },
  ];
  for (const [i, a] of visitorActivityTypes.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'visitor_activity_type', key: a.key } },
      create: { tenantId: tenant.id, namespace: 'visitor_activity_type', key: a.key, label: a.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (document categories)...');
  const documentCategories = [
    { key: 'policy', label: 'Policy' },
    { key: 'minutes', label: 'Meeting Minutes' },
    { key: 'form', label: 'Form' },
    { key: 'certificate', label: 'Certificate' },
    { key: 'sermon_notes', label: 'Sermon Notes' },
    { key: 'legal', label: 'Legal' },
    { key: 'other', label: 'Other' },
  ];
  for (const [i, c] of documentCategories.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'document_category', key: c.key } },
      create: { tenantId: tenant.id, namespace: 'document_category', key: c.key, label: c.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example configuration items (small group types)...');
  const smallGroupTypes = [
    { key: 'home_group', label: 'Home Group' },
    { key: 'cell_group', label: 'Cell Group' },
    { key: 'sunday_school', label: 'Sunday School' },
    { key: 'youth_group', label: 'Youth Group' },
    { key: 'bible_study', label: 'Bible Study' },
    { key: 'other', label: 'Other' },
  ];
  for (const [i, g] of smallGroupTypes.entries()) {
    await prisma.configItem.upsert({
      where: { tenantId_namespace_key: { tenantId: tenant.id, namespace: 'small_group_type', key: g.key } },
      create: { tenantId: tenant.id, namespace: 'small_group_type', key: g.key, label: g.label, value: {}, sortOrder: i },
      update: {},
    });
  }

  console.log('Seeding example custom field definitions (asset:vehicle, asset:building)...');
  const assetCustomFieldsByEntityType = {
    'asset:vehicle': [
      { fieldKey: 'make_model', label: 'Make / Model', fieldType: 'text', sortOrder: 0 },
      { fieldKey: 'license_plate', label: 'License Plate', fieldType: 'text', sortOrder: 1 },
      { fieldKey: 'mileage_km', label: 'Mileage (km)', fieldType: 'number', sortOrder: 2 },
      { fieldKey: 'insurance_document', label: 'Insurance Document', fieldType: 'file', sortOrder: 3 },
    ],
    'asset:building': [
      { fieldKey: 'square_meters', label: 'Floor Area (sqm)', fieldType: 'number', sortOrder: 0 },
      { fieldKey: 'floors', label: 'Number of Floors', fieldType: 'number', sortOrder: 1 },
      { fieldKey: 'ownership_document', label: 'Ownership Document', fieldType: 'file', sortOrder: 2 },
    ],
  };
  for (const [entityType, fields] of Object.entries(assetCustomFieldsByEntityType)) {
    for (const cf of fields) {
      await prisma.customFieldDefinition.upsert({
        where: { tenantId_entityType_fieldKey: { tenantId: tenant.id, entityType, fieldKey: cf.fieldKey as string } },
        create: { tenantId: tenant.id, entityType, ...cf },
        update: {},
      });
    }
  }

  console.log('Seeding example custom field definitions (member)...');
  const memberCustomFields = [
    {
      fieldKey: 'confirmation_date',
      label: 'Confirmation Date',
      fieldType: 'date',
      sortOrder: 0,
    },
    {
      fieldKey: 'spiritual_gift',
      label: 'Spiritual Gift',
      fieldType: 'select',
      options: [
        { key: 'teaching', label: 'Teaching' },
        { key: 'worship', label: 'Worship' },
        { key: 'hospitality', label: 'Hospitality' },
        { key: 'evangelism', label: 'Evangelism' },
      ],
      sortOrder: 1,
    },
  ];
  for (const cf of memberCustomFields) {
    await prisma.customFieldDefinition.upsert({
      where: { tenantId_entityType_fieldKey: { tenantId: tenant.id, entityType: 'member', fieldKey: cf.fieldKey } },
      create: { tenantId: tenant.id, entityType: 'member', ...cf },
      update: {},
    });
  }

  console.log('Seeding headquarters branch and completing onboarding...');
  const hqBranch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, isHeadquarters: true } });
  if (!hqBranch) {
    await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: tenant.name,
        branchType: 'headquarters',
        isHeadquarters: true,
        sortOrder: 0,
      },
    });
  }
  if (!tenant.onboardedAt) {
    await prisma.tenant.update({ where: { id: tenant.id }, data: { onboardedAt: new Date() } });
  }

  console.log(`Done. Demo login: admin@demo-church.test / ChangeMe123 (tenant slug: ${tenant.slug})`);
  console.log('Platform admin login: platform-admin@ucms.app / ChangeMe123 (no tenant slug — POST /platform/auth/login)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
