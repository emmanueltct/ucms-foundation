// lib/knowledge-base-content.tsx
// Content for the in-app Knowledge Base / test guide (app/admin/help). One
// entry per shipped module: what it does, the requirements it satisfies,
// and a numbered manual test script a QA person (or a curious admin) can
// run against the live demo tenant. Sourced from docs/*/business-analysis.md
// and docs/*/functional-requirements.md, condensed for an in-app reader.

import type { LucideIcon } from 'lucide-react';
import {
  ShieldCheck,
  SlidersHorizontal,
  ListPlus,
  Building2,
  Users,
  Wallet,
  CalendarCheck,
  HeartHandshake,
  Users2,
  Bell,
  CalendarDays,
  Briefcase,
  BarChart3,
  Boxes,
  UserPlus,
  FileText,
} from 'lucide-react';

export type CoverageStatus = 'complete' | 'partial';

export interface TestScenario {
  title: string;
  steps: string[];
}

export interface KnowledgeBaseModule {
  slug: string;
  moduleLabel: string;
  title: string;
  status: CoverageStatus;
  icon: LucideIcon;
  path?: string;
  summary: string;
  requirements: string[];
  knownGaps?: string[];
  scenarios: TestScenario[];
}

const DEMO_LOGIN = 'admin@demo-church.test / ChangeMe123 (workspace: demo-church)';

export const knowledgeBaseModules: KnowledgeBaseModule[] = [
  {
    slug: 'foundation',
    moduleLabel: 'Foundation',
    title: 'Authentication & Multi-Tenancy',
    status: 'complete',
    icon: ShieldCheck,
    path: '/login',
    summary:
      'Every request is resolved to one tenant (church) before anything else runs. Sign-in issues a short-lived access token plus a refresh token, and every route is guarded first by role (RBAC), then by fine-grained permission code (PBAC) — never by branching on a role’s name.',
    requirements: [
      'A user signs in against one tenant workspace (slug), not a global account',
      'JWT access token + refresh token issued on login; refresh rotates the old token',
      'Every tenant-owned database row carries a tenantId and is scoped automatically — no tenant can see another tenant’s data',
      'Authorization is permission-code based (module.entity.action), guarded per-route',
      'Optional TOTP multi-factor authentication (enroll/verify/disable) is available at the API level',
      'Passwords are hashed (bcrypt); rate limiting applies to auth endpoints',
    ],
    knownGaps: [
      'MFA enrollment/verification has API endpoints (`/auth/mfa/*`) but no dedicated frontend screen yet.',
    ],
    scenarios: [
      {
        title: 'Sign in and reach the dashboard',
        steps: [
          `Go to /login.`,
          'Confirm the "Church workspace" field reads demo-church (or type it).',
          `Enter the demo credentials: ${DEMO_LOGIN}.`,
          'Click "Sign in".',
          'Expected: you land on /admin with a sidebar and live stat tiles — this confirms the token was issued and the dashboard’s first round of API calls succeeded.',
        ],
      },
      {
        title: 'Reject an unknown or wrong password',
        steps: [
          'On /login, enter the correct email with an incorrect password.',
          'Click "Sign in".',
          'Expected: a red error banner appears and you stay on the login page — no token is issued.',
        ],
      },
      {
        title: 'Confirm a permission actually gates a route',
        steps: [
          'While signed in as the demo admin (who has every permission), open the browser’s network tab.',
          'Visit any admin page, e.g. /admin/finance.',
          'Expected: API calls include an `Authorization: Bearer ...` header and an `X-Tenant-Slug: demo-church` header — removing either (e.g. by signing out) causes subsequent calls to fail with 401.',
        ],
      },
    ],
  },
  {
    slug: 'config-engine',
    moduleLabel: 'Cross-cutting',
    title: 'Configuration Engine',
    status: 'complete',
    icon: SlidersHorizontal,
    path: '/admin/config',
    summary:
      'The mechanism behind "everything must be configurable, nothing hard-coded." Every tenant-specific list of options across the whole platform (branch types, contribution types, service types, ministry types, asset categories, and more) is a row in one generic ConfigItem table, organized by namespace — never a fixed enum in the schema.',
    requirements: [
      'A ConfigItem has a namespace, a key, and a display label, scoped to one tenant',
      'Items can be deactivated ("retired") and reactivated without ever being deleted',
      'Every other module reads its dropdown options from here at request time — adding an item requires zero code changes',
      '16 namespaces exist today: branch_type, membership_category, contribution_type, service_type, attendance_method, ministry_type, small_group_type, event_type, staff_position, department, asset_category, asset_condition, visitor_source, visitor_group_type, visitor_activity_type, document_category',
    ],
    scenarios: [
      {
        title: 'Add a new option and retire it',
        steps: [
          'Go to Configuration.',
          'Click the "Contribution Types" tab.',
          'Type a new label, e.g. "Vehicle Fund", into the input and click "Add".',
          'Expected: the new item appears in the list immediately below.',
          'Click "Retire" next to it.',
          'Expected: the label greys out with a strikethrough and the button now reads "Restore".',
        ],
      },
      {
        title: 'Confirm a new option shows up where it’s actually used',
        steps: [
          'Add a new "Contribution Types" item, e.g. "Vehicle Fund" (as above).',
          'Go to Finance and open the "Type" dropdown in the contribution form.',
          'Expected: "Vehicle Fund" appears as a selectable option — proving the list is read live from configuration, not hard-coded in the frontend.',
        ],
      },
    ],
  },
  {
    slug: 'custom-fields',
    moduleLabel: 'Cross-cutting',
    title: 'Custom Fields',
    status: 'complete',
    icon: ListPlus,
    path: '/admin/settings/custom-fields',
    summary:
      'The other half of "everything configurable": ConfigItem changes dropdown *values*, Custom Fields let a church add entirely new *fields* to a form — a Confirmation Date, a Spiritual Gift, a vehicle’s mileage — with zero code changes. Six field types are supported, including file uploads.',
    requirements: [
      'A field definition has an entityType, a stable key, a label, and one of six types: text, number, date, boolean, select, file',
      'Dropdown (select) fields require at least one option',
      'Required fields are enforced before the parent record is created',
      'Values are validated against the field’s declared type before being saved',
      'A field can be retired (hidden from new forms) without losing historical values already recorded',
      'Asset categories automatically appear here as `asset:{category}` entity types — one Custom Fields mechanism, reused per category',
    ],
    scenarios: [
      {
        title: 'Define a text field and see it appear on the Members form',
        steps: [
          'Go to Custom Fields.',
          'Confirm the "Member" pill is selected.',
          'Enter a label, e.g. "Preferred Language", leave the key blank (it auto-generates from the label), leave type as "Text".',
          'Click "Add field".',
          'Go to Members and look at the create-member form.',
          'Expected: "Preferred Language" now appears as an input field, with no code change required.',
        ],
      },
      {
        title: 'Define a required Dropdown field and confirm it’s enforced',
        steps: [
          'On Custom Fields, add a field with type "Dropdown", options like `north:North Campus, south:South Campus`, and check "Required".',
          'Go to Members and try creating a member without selecting a value for that new dropdown.',
          'Expected: the creation is rejected with a message naming the missing required field.',
        ],
      },
      {
        title: 'Retire a field',
        steps: [
          'On Custom Fields, click "Retire" next to any field you added.',
          'Return to the Members create form.',
          'Expected: the retired field no longer appears on new forms, while any values already saved for existing members remain intact.',
        ],
      },
    ],
  },
  {
    slug: 'church-hierarchy',
    moduleLabel: 'Module 1',
    title: 'Church & Hierarchy Management',
    status: 'complete',
    icon: Building2,
    path: '/admin/branches',
    summary:
      'A church’s organizational structure — headquarters, parishes, districts, cells — modeled as one self-referencing tree so both a flat independent church and a multi-level diocese fit the same schema. Branch "type" is configuration, not a fixed level.',
    requirements: [
      'A branch may have a parent branch, at any depth',
      'Branch type (parish, district, cell, ...) is a ConfigItem, not hard-coded',
      'Moving a branch to a new parent is a dedicated action that rejects a cycle (moving a branch under its own descendant)',
      'Deactivating a branch cascades to its descendants',
      'Exactly one branch is flagged as headquarters',
    ],
    scenarios: [
      {
        title: 'Create a branch under a parent',
        steps: [
          'Go to Branches.',
          'Fill in Name (e.g. "Kigali Parish"), pick a Branch Type, and choose a parent from the tree (or leave as headquarters-level).',
          'Click "Add branch".',
          'Expected: the new branch appears nested under the chosen parent in the tree view.',
        ],
      },
      {
        title: 'Move a branch to a different parent',
        steps: [
          'In the branch tree, use the move control on an existing non-headquarters branch to reassign its parent.',
          'Expected: the tree re-renders with the branch under its new parent; attempting to move a branch underneath one of its own children is rejected.',
        ],
      },
      {
        title: 'Deactivate a branch and confirm the cascade',
        steps: [
          'Deactivate a branch that has child branches.',
          'Expected: the branch and all of its descendants are marked inactive together.',
        ],
      },
    ],
  },
  {
    slug: 'members-families',
    moduleLabel: 'Module 2',
    title: 'Member & Family Management',
    status: 'complete',
    icon: Users,
    path: '/admin/members',
    summary:
      'Member profiles attached to exactly one branch, optionally grouped into a household (Family). Custom Fields render dynamically alongside the fixed fields, so every church’s intake form looks different without a code change.',
    requirements: [
      'A member always belongs to exactly one branch',
      'Changing a member’s branch is a transfer, validated against the target branch',
      'A member may optionally belong to a Family with a role (head, spouse, child, other)',
      'A family’s head is auto-cleared if that member leaves the family or is removed',
      'Custom Fields defined for "member" render on the create form automatically',
    ],
    knownGaps: [
      'There is no dedicated Families admin page yet — families are selected from an existing list on the Members page; creating a brand-new family currently requires the API directly.',
    ],
    scenarios: [
      {
        title: 'Add a member',
        steps: [
          'Go to Members.',
          'Fill in First name, Last name, and select a Branch (required).',
          'Optionally pick a Family, enter phone/email, and fill in any Custom Fields shown.',
          'Click "Add member".',
          'Expected: the new member appears in the list below with the details you entered.',
        ],
      },
      {
        title: 'Search and filter',
        steps: [
          'Type part of a member’s name, phone, or email into the search box.',
          'Expected: the list filters to matching members as you type.',
        ],
      },
      {
        title: 'Transfer a member to a different branch',
        steps: [
          'Find a member in the list and change their Branch via the editable dropdown shown against their row.',
          'Expected: the member now appears under the new branch; the change is validated against that branch existing in the tenant.',
        ],
      },
    ],
  },
  {
    slug: 'finance',
    moduleLabel: 'Module 3',
    title: 'Finance',
    status: 'partial',
    icon: Wallet,
    path: '/admin/finance',
    summary:
      'Records tithes, offerings, and other gifts against a branch and, optionally, a named member. A contribution is never edited or deleted once recorded — a mistake is corrected by voiding it with a mandatory reason, preserving the audit trail.',
    requirements: [
      'A contribution requires a branch, a type (ConfigItem), an amount, and a payment method',
      'Only notes/receipt number can be edited after creation — everything else is locked',
      'Voiding requires a reason and is the only way to "undo" a contribution',
      'Totals-by-type summary excludes voided contributions unless explicitly requested',
      'Receipt numbers, if provided, must be unique per tenant',
    ],
    knownGaps: [
      'No online giving: contributions are recorded manually by a Finance Officer. There is no MTN MoMo / Airtel Money / card payment gateway integration or a member-facing self-service giving portal yet — this is a documented gap against the original requirements (see the coverage report).',
    ],
    scenarios: [
      {
        title: 'Record a contribution',
        steps: [
          'Go to Finance.',
          'Select a Branch, optionally a Member, a contribution Type, an Amount, and a Payment method.',
          'Click "Record contribution".',
          'Expected: it appears in the list and the totals-by-type summary above updates.',
        ],
      },
      {
        title: 'Void a contribution',
        steps: [
          'Click "Void" on an existing contribution.',
          'Type a reason when prompted and confirm.',
          'Expected: the contribution shows a "voided" badge and its amount is excluded from the summary totals.',
        ],
      },
      {
        title: 'Confirm a voided contribution cannot be voided again',
        steps: [
          'Attempt to void the same contribution a second time.',
          'Expected: the action is rejected — a contribution can only be voided once.',
        ],
      },
    ],
  },
  {
    slug: 'attendance',
    moduleLabel: 'Module 4',
    title: 'Attendance',
    status: 'complete',
    icon: CalendarCheck,
    path: '/admin/attendance',
    summary:
      'Records either one named member’s check-in (always counts as 1) or an anonymous bulk head-count for a service. Unlike Finance, a mis-typed record can be corrected in place or removed outright — there’s no audit-trail obligation the way there is with money.',
    requirements: [
      'A record is either tied to a member (headcount forced to 1) or anonymous (headcount required, caller-supplied)',
      'Service type and attendance method are both ConfigItem-driven',
      'A named member cannot be checked in twice for the same branch/service/date',
      'Records can be corrected via PATCH or removed via DELETE (soft delete)',
      'A totals-by-service-type summary is available',
    ],
    scenarios: [
      {
        title: 'Record an anonymous head-count',
        steps: [
          'Go to Attendance.',
          'Select a Branch and a Service type, leave Member unselected, and enter a Headcount.',
          'Click "Record attendance".',
          'Expected: the entry appears in the list and counts toward the service-type summary.',
        ],
      },
      {
        title: 'Record a named check-in and confirm the duplicate guard',
        steps: [
          'Record attendance again, this time selecting a specific Member for the same branch/service/date.',
          'Try submitting the exact same member/branch/service/date combination a second time.',
          'Expected: the second attempt is rejected as a duplicate check-in.',
        ],
      },
    ],
  },
  {
    slug: 'ministries',
    moduleLabel: 'Module 5',
    title: 'Ministry & Volunteer Management',
    status: 'complete',
    icon: HeartHandshake,
    path: '/admin/ministries',
    summary:
      'Volunteer serving teams (ushering, choir, media) — flat, optionally scoped to a branch, with a roster of members who each hold a role. Leadership is just a role value, so a ministry can have co-leaders.',
    requirements: [
      'A ministry name must be unique per tenant',
      'Ministry type is a ConfigItem, not hard-coded',
      'A member can hold a role (leader, volunteer, member) within a ministry, with no limit on co-leaders',
      'A member cannot have two membership rows for the same ministry',
      'Deleting a ministry deactivates its roster rather than deleting volunteer history',
    ],
    scenarios: [
      {
        title: 'Create a ministry and build its roster',
        steps: [
          'Go to Ministries.',
          'Enter a Name (e.g. "Media Team"), optionally a Type and Branch.',
          'Click "Create ministry".',
          'Select the new ministry, choose a member and a role from the roster form, click "Add".',
          'Expected: the member appears in the roster list with their role.',
        ],
      },
      {
        title: 'Add a second leader (co-leadership)',
        steps: [
          'With a ministry already having one "leader", add a different member with role "leader" too.',
          'Expected: both are accepted — there’s no unique-leader constraint.',
        ],
      },
    ],
  },
  {
    slug: 'small-groups',
    moduleLabel: 'Module 13',
    title: "Small Groups & Children's Ministry",
    status: 'complete',
    icon: Users2,
    path: '/admin/small-groups',
    summary:
      'Home groups, cell groups, Bible studies, and age-graded Sunday School classes. Structurally similar to Ministry (flat, role-based roster) but carries scheduling, capacity, and age-range fields a volunteer team has no use for.',
    requirements: [
      'A group name must be unique per tenant',
      'Meeting day is a fixed Monday–Sunday value; meeting time is 24-hour HH:mm',
      'If both minAge and maxAge are set, minAge cannot exceed maxAge',
      'Capacity is a soft cap — a new member is rejected once the group is full',
      'Roles: leader, co_leader, member',
    ],
    scenarios: [
      {
        title: 'Create a children’s Sunday School class with an age range',
        steps: [
          'Go to Small Groups.',
          'Enter a Name (e.g. "Sunday School — Ages 6-9"), Type "Sunday School", meeting Day "Sunday", a Capacity, and Min/Max age 6 and 9.',
          'Click "Create small group".',
          'Expected: the class appears in the list showing its schedule and age range.',
        ],
      },
      {
        title: 'Fill a group to capacity and confirm the cap is enforced',
        steps: [
          'Create a small group with Capacity set to 1.',
          'Select it and add one member to the roster — this succeeds.',
          'Try adding a second member.',
          'Expected: the second addition is rejected because the group is full.',
        ],
      },
      {
        title: 'Reject an invalid age range',
        steps: [
          'Try creating a group with Min age 10 and Max age 6.',
          'Expected: the request is rejected before the group is created.',
        ],
      },
    ],
  },
  {
    slug: 'communication',
    moduleLabel: 'Module 6',
    title: 'Communication',
    status: 'partial',
    icon: Bell,
    path: '/admin/notifications',
    summary:
      'A durable record of every notification (email/SMS/push) sent or attempted, dispatched asynchronously through a BullMQ queue. The record and the queue pipeline are fully real — the actual gateway call is a documented stub that logs instead of sending.',
    requirements: [
      'A notification requires a channel and a body, and either an explicit recipient address or a member to resolve one from',
      'Creating a notification returns immediately with status "queued"; a background worker updates it to "sent" or "failed"',
      'Notification history is filterable by channel, status, and member',
    ],
    knownGaps: [
      'No real SMS/Email/Push gateway is wired in — the queue worker logs what it would have sent and marks the record "sent", but nothing is actually delivered externally yet. This is a documented, single, clearly marked seam to swap in a real provider later.',
    ],
    scenarios: [
      {
        title: 'Send a notification and watch it complete',
        steps: [
          'Go to Notifications.',
          'Choose a Channel (email/sms/push), select a Member or type a recipient address, and enter a message body.',
          'Click "Send".',
          'Expected: the notification appears with status "queued", then updates to "sent" within a second or two once the background worker processes it.',
        ],
      },
      {
        title: 'Filter notification history',
        steps: [
          'Use the channel/status filters above the list.',
          'Expected: the list narrows to matching notifications only.',
        ],
      },
    ],
  },
  {
    slug: 'events',
    moduleLabel: 'Module 7',
    title: 'Events',
    status: 'complete',
    icon: CalendarDays,
    path: '/admin/events',
    summary:
      'Scheduling for one-off gatherings (conferences, camps, socials) beyond regular services, with registration by a named member or a walk-in guest, and a soft capacity cap.',
    requirements: [
      'An event may be church-wide or scoped to a branch',
      'A registrant is either a named member or a guest with a name — never neither',
      'A member cannot register twice for the same event; guests are not deduplicated',
      'If capacity is set, registration is rejected once the cap is reached',
      'Deleting an event cancels all of its registrations',
    ],
    scenarios: [
      {
        title: 'Create an event and register a member',
        steps: [
          'Go to Events.',
          'Enter a Name, a Start date/time, and optionally a Capacity.',
          'Click "Create event".',
          'Select the event, choose a member in the registration form, click "Register".',
          'Expected: the registration appears in the event’s attendee list.',
        ],
      },
      {
        title: 'Register a walk-in guest',
        steps: [
          'On the same event, register with a guest name instead of selecting a member.',
          'Expected: the guest registration is accepted and listed alongside member registrations.',
        ],
      },
      {
        title: 'Fill an event to capacity',
        steps: [
          'Create an event with Capacity 1 and register one attendee.',
          'Attempt a second registration.',
          'Expected: it’s rejected — the event is full.',
        ],
      },
    ],
  },
  {
    slug: 'hr-payroll',
    moduleLabel: 'Module 8',
    title: 'HR & Payroll',
    status: 'complete',
    icon: Briefcase,
    path: '/admin/hr',
    summary:
      'Staff records — always the person’s own record, optionally linked to a Member if they’re also a congregant — with payroll payments that follow a strict pending → paid | cancelled lifecycle, mirroring Finance’s "never edit money after the fact" discipline.',
    requirements: [
      'A staff record has a position and department (both ConfigItem-driven) and an employment type/status',
      'A payroll payment starts pending; only pending payments can be edited or cancelled',
      'Marking a payment paid or cancelling it (with a mandatory reason) are both one-way — a paid or cancelled payment can never be edited again',
      'Deductions cannot exceed the gross amount',
    ],
    scenarios: [
      {
        title: 'Add a staff record and create a pending payment',
        steps: [
          'Go to HR & Payroll.',
          'Fill in First/Last name, optionally a Position and Department, and an Employment type.',
          'Click "Add staff".',
          'Select the new staff member, fill in a pay period and gross amount, click "Create payment".',
          'Expected: the payment appears with status "pending".',
        ],
      },
      {
        title: 'Mark a payment paid, then confirm it’s locked',
        steps: [
          'Click "Mark paid" on a pending payment.',
          'Expected: its status changes to "paid" and the mark-paid/cancel actions disappear — it can no longer be modified.',
        ],
      },
      {
        title: 'Cancel a pending payment with a reason',
        steps: [
          'Create a new pending payment, then click "Cancel" on it.',
          'Provide a reason when prompted.',
          'Expected: the payment shows status "cancelled" with the reason retained.',
        ],
      },
    ],
  },
  {
    slug: 'reports',
    moduleLabel: 'Module 9',
    title: 'Reports & Analytics',
    status: 'complete',
    icon: BarChart3,
    path: '/admin/reports',
    summary:
      'A read-only dashboard computed live from Finance, Attendance, Membership, Events, and HR & Payroll data — no separate reporting tables. Trends default to a trailing 12-month window and are zero-filled so a quiet month never breaks a chart.',
    requirements: [
      'Overview KPIs: active members, active staff, branches, upcoming events, this-month giving, 30-day attendance',
      'Finance, attendance, and payroll trends are shown by month and by category/type',
      'Membership growth shows new members per month plus a running cumulative-active count',
      'Voided contributions and cancelled payments are always excluded from totals',
    ],
    scenarios: [
      {
        title: 'View the dashboard and confirm it reflects real data',
        steps: [
          'Go to Reports.',
          'Note the "Giving this month" and "Attendance (30d)" KPI tiles.',
          'Go to Finance and record a new contribution dated today.',
          'Return to Reports and refresh.',
          'Expected: "Giving this month" increases by the new contribution’s amount.',
        ],
      },
      {
        title: 'Confirm charts are zero-filled, not gapped',
        steps: [
          'Look at the "Giving by month" chart.',
          'Expected: every month in the trailing-12-month window appears on the x-axis, even ones with no contributions (shown as zero), rather than being skipped.',
        ],
      },
    ],
  },
  {
    slug: 'assets',
    moduleLabel: 'Module 10',
    title: 'Asset & Facility Management',
    status: 'complete',
    icon: Boxes,
    path: '/admin/assets',
    summary:
      'A register of church-owned physical assets under a tenant-configurable category. Each category gets its own set of extra fields — a vehicle’s mileage, a building’s floor count — through the same Custom Fields mechanism Members use, including file uploads for documents like insurance certificates.',
    requirements: [
      'An asset requires a name and a category (ConfigItem); category is fixed once created',
      'Custom fields defined for `asset:{category}` render dynamically once a category is chosen',
      'File-type custom fields can only be uploaded after the asset exists (they need its id first)',
      'Only PDF/JPEG/PNG/DOC/DOCX are accepted for uploads, capped at 10MB',
      'A duplicate asset tag within the tenant is rejected',
    ],
    scenarios: [
      {
        title: 'Register a vehicle and fill its category-specific fields',
        steps: [
          'Go to Assets.',
          'Enter a Name (e.g. "Toyota Hiace — Youth Van") and pick Category "Vehicle".',
          'Expected: extra fields appear — Make/Model, License Plate, Mileage — since these are defined for asset:vehicle.',
          'Fill them in and click "Register asset".',
          'Expected: the asset appears in the list with its category and tag shown.',
        ],
      },
      {
        title: 'Upload a document to an existing asset',
        steps: [
          'Select the vehicle you just created.',
          'Expected: the "Insurance Document" field now shows a working file-picker (it showed "save first, then upload" before the asset existed).',
          'Choose a PDF or image file to upload.',
          'Expected: a download link with the filename appears once the upload completes.',
        ],
      },
      {
        title: 'Change an asset’s status',
        steps: [
          'On the selected asset, change Status to "Under maintenance" via the dropdown.',
          'Expected: the asset’s status badge in the list updates immediately.',
        ],
      },
    ],
  },
  {
    slug: 'visitors',
    moduleLabel: 'Module 11',
    title: 'Visitor & Follow-up Management',
    status: 'complete',
    icon: UserPlus,
    path: '/admin/visitors',
    summary:
      'Tracks both individual visitors and whole visiting groups (families, delegations, choir/youth visits, conference parties, mission teams) from initial contact through a history of tenant-configurable activities (First Visit, Counseling, Prayer, Follow-up, Baptism Class, ...) to, for individuals, (optionally) becoming a Member. Converting to a member is a dedicated action that links the two records, rather than a plain status edit.',
    requirements: [
      'A visitor starts with status "new"; status can be changed freely except directly to "joined"',
      'Converting to a member requires an existing member record and links convertedMemberId',
      'A member can only be linked to one visitor record',
      'An individual visitor may optionally belong to a VisitorGroup (family, delegation, choir visit, ...)',
      'Activities (First Visit, Counseling, Prayer, Follow-up, Baptism Class, Marriage Class, ...) are tenant-defined via Configuration → Visitor Activity Types, each with its own optional Custom Fields, and are logged as an append-only history against either an individual visitor or a whole group — never edited or deleted',
    ],
    scenarios: [
      {
        title: 'Record a visitor and log an activity',
        steps: [
          'Go to Visitors → Individuals.',
          'Fill in First/Last name and a Visit date, optionally How they heard, a Group, and Assign follow-up to.',
          'Click "Record visitor".',
          'Select the visitor, choose an Activity type (e.g. "Follow-up"), optionally fill in its custom fields, an outcome/notes, click "Log activity".',
          'Expected: the activity appears in the visitor’s history, most recent first.',
        ],
      },
      {
        title: 'Record a visiting group and its members',
        steps: [
          'Go to Visitors → Groups, fill in a name, Group type, and Visit date, click "Record group".',
          'Go to Individuals, record each member of the group, selecting it from "Arrived with group".',
          'Back on Groups, select the group.',
          'Expected: every linked individual appears under "Members", and activities can be logged against the group as a whole (e.g. "hosted the choir for evening service") separately from any per-member activity.',
        ],
      },
      {
        title: 'Convert a visitor to a member',
        steps: [
          'First, create a Member for this person via the Members page.',
          'Back on Visitors, select the visitor and choose that member from the "Convert to member" dropdown, then click "Convert".',
          'Expected: the visitor’s status becomes "Joined" and shows the linked member’s name instead of a status dropdown.',
        ],
      },
      {
        title: 'Confirm status can’t be set to "joined" directly',
        steps: [
          '(API-level check) Attempt PATCH /visitors/:id with `{ "status": "joined" }` directly, without using /convert.',
          'Expected: rejected with `VISITOR_USE_CONVERT_ENDPOINT` — joining only happens through the dedicated conversion action.',
        ],
      },
    ],
  },
  {
    slug: 'documents',
    moduleLabel: 'Module 12',
    title: 'Document Management',
    status: 'complete',
    icon: FileText,
    path: '/admin/documents',
    summary:
      'A categorized store for church documents — policies, meeting minutes, forms, certificates, sermon notes, legal paperwork. Unlike an Asset’s file-type custom field (an attachment on someone else’s record), a Document is the record itself: metadata and file upload happen together in one step.',
    requirements: [
      'Uploading requires a title, a category (ConfigItem), and a file, all submitted together',
      'Accepted types: PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX, plain text, capped at 10MB',
      'Replacing a file is a separate action from editing title/category/description',
      'Downloading returns a time-limited signed URL, never the file directly through the API',
    ],
    scenarios: [
      {
        title: 'Upload a document',
        steps: [
          'Go to Documents.',
          'Enter a Title (e.g. "Board Meeting Minutes — March 2026"), pick a Category ("Meeting Minutes"), choose a file.',
          'Click "Upload document".',
          'Expected: the document appears in the list showing its category, filename, and size.',
        ],
      },
      {
        title: 'Download a document',
        steps: [
          'Click "Download" on any document in the list.',
          'Expected: a new tab opens with a signed URL that serves the file.',
        ],
      },
      {
        title: 'Replace a document’s file',
        steps: [
          'Click "Replace file" on an existing document and choose a new file.',
          'Expected: the file name/size in the list updates to the new file, while the title/category/description are unchanged.',
        ],
      },
    ],
  },
];
