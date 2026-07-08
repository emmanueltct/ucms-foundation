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
      userRoles: { create: [{ roleId: adminRole.id }] },
    },
    update: {},
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
