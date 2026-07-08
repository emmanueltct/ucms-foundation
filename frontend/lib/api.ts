// lib/api.ts
// Thin fetch wrapper matching the backend's standard response envelope
// and tenant-resolution contract (X-Tenant-Slug header).

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  meta: Record<string, unknown> | null;
  error: ApiError | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

// NOTE: browser storage (localStorage) is intentionally NOT used here so this
// file behaves the same whether it's copied into a real Next.js app (fine
// there) or previewed as an artifact (where storage APIs are unsupported).
// A real app should persist tokens in an httpOnly cookie set by a
// server action / route handler, not in client-readable storage at all.
let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

export function setSession(accessToken: string, refreshToken: string) {
  inMemoryAccessToken = accessToken;
  inMemoryRefreshToken = refreshToken;
}

export function clearSession() {
  inMemoryAccessToken = null;
  inMemoryRefreshToken = null;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  tenantSlug: string;
  auth?: boolean;
}

export async function apiRequest<T>(path: string, opts: RequestOptions): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': opts.tenantSlug,
  };

  if (opts.auth && inMemoryAccessToken) {
    headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const json = (await res.json()) as ApiEnvelope<T>;
  return json;
}

export const authApi = {
  login: (tenantSlug: string, email: string, password: string) =>
    apiRequest<{ user: any; tokens: { accessToken: string; refreshToken: string } }>('/auth/login', {
      method: 'POST',
      tenantSlug,
      body: { email, password },
    }),
};

export const configApi = {
  listByNamespace: (tenantSlug: string, namespace: string) =>
    apiRequest<any[]>(`/config/items?namespace=${encodeURIComponent(namespace)}`, { tenantSlug, auth: true }),
  create: (tenantSlug: string, item: { namespace: string; key: string; label: string; value: Record<string, unknown> }) =>
    apiRequest<any>('/config/items', { method: 'POST', tenantSlug, auth: true, body: item }),
  deactivate: (tenantSlug: string, id: string) =>
    apiRequest<any>(`/config/items/${id}/deactivate`, { method: 'PATCH', tenantSlug, auth: true }),
  reactivate: (tenantSlug: string, id: string) =>
    apiRequest<any>(`/config/items/${id}/reactivate`, { method: 'PATCH', tenantSlug, auth: true }),
};

export interface Branch {
  id: string;
  parentBranchId: string | null;
  name: string;
  branchType: string | null;
  code: string | null;
  address: string | null;
  isHeadquarters: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface BranchTreeNode extends Branch {
  children: BranchTreeNode[];
}

export const branchesApi = {
  tree: (tenantSlug: string, includeInactive = false) =>
    apiRequest<BranchTreeNode[]>(`/branches/tree?includeInactive=${includeInactive}`, { tenantSlug, auth: true }),
  list: (tenantSlug: string, includeInactive = false) =>
    apiRequest<Branch[]>(`/branches?includeInactive=${includeInactive}`, { tenantSlug, auth: true }),
  create: (
    tenantSlug: string,
    branch: { name: string; parentBranchId?: string; branchType?: string; isHeadquarters?: boolean },
  ) => apiRequest<Branch>('/branches', { method: 'POST', tenantSlug, auth: true, body: branch }),
  move: (tenantSlug: string, id: string, parentBranchId: string | null) =>
    apiRequest<Branch>(`/branches/${id}/move`, { method: 'PATCH', tenantSlug, auth: true, body: { parentBranchId } }),
  deactivate: (tenantSlug: string, id: string) =>
    apiRequest<Branch>(`/branches/${id}/deactivate`, { method: 'PATCH', tenantSlug, auth: true }),
  reactivate: (tenantSlug: string, id: string) =>
    apiRequest<Branch>(`/branches/${id}/reactivate`, { method: 'PATCH', tenantSlug, auth: true }),
};

export interface Family {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  headOfFamilyId: string | null;
  notes: string | null;
  isActive: boolean;
}

export const familiesApi = {
  list: (tenantSlug: string, search = '') =>
    apiRequest<Family[]>(`/families?pageSize=100${search ? `&search=${encodeURIComponent(search)}` : ''}`, {
      tenantSlug,
      auth: true,
    }),
  create: (tenantSlug: string, family: { name: string; address?: string; phone?: string; notes?: string }) =>
    apiRequest<Family>('/families', { method: 'POST', tenantSlug, auth: true, body: family }),
  members: (tenantSlug: string, id: string) =>
    apiRequest<Member[]>(`/families/${id}/members`, { tenantSlug, auth: true }),
  setHead: (tenantSlug: string, id: string, memberId: string | null) =>
    apiRequest<Family>(`/families/${id}/head`, { method: 'PATCH', tenantSlug, auth: true, body: { memberId } }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<Family>(`/families/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export interface Member {
  id: string;
  branchId: string;
  familyId: string | null;
  familyRole: string | null;
  membershipNumber: string | null;
  firstName: string;
  lastName: string;
  gender: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  maritalStatus: string | null;
  membershipCategory: string | null;
  membershipStatus: string;
  joinedAt: string | null;
  baptismDate: string | null;
  photoUrl: string | null;
  notes: string | null;
  isActive: boolean;
  customFields: Record<string, unknown>;
}

export interface MemberListMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateMemberInput {
  branchId: string;
  familyId?: string;
  familyRole?: string;
  membershipNumber?: string;
  firstName: string;
  lastName: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  membershipCategory?: string;
  membershipStatus?: string;
  customFields?: Record<string, unknown>;
}

export const membersApi = {
  list: (
    tenantSlug: string,
    params: { search?: string; branchId?: string; familyId?: string; membershipStatus?: string; page?: number } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.familyId) qs.set('familyId', params.familyId);
    if (params.membershipStatus) qs.set('membershipStatus', params.membershipStatus);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', '20');
    return apiRequest<Member[]>(`/members?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, member: CreateMemberInput) =>
    apiRequest<Member>('/members', { method: 'POST', tenantSlug, auth: true, body: member }),
  update: (tenantSlug: string, id: string, member: Partial<CreateMemberInput>) =>
    apiRequest<Member>(`/members/${id}`, { method: 'PATCH', tenantSlug, auth: true, body: member }),
  transfer: (tenantSlug: string, id: string, branchId: string) =>
    apiRequest<Member>(`/members/${id}/transfer`, { method: 'PATCH', tenantSlug, auth: true, body: { branchId } }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<Member>(`/members/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export interface Contribution {
  id: string;
  branchId: string;
  memberId: string | null;
  contributionType: string;
  amount: string;
  currency: string;
  paymentMethod: string;
  receiptNumber: string | null;
  contributedAt: string;
  recordedByUserId: string | null;
  notes: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface ContributionSummary {
  contributionType: string;
  total: string;
  count: number;
}

export interface CreateContributionInput {
  branchId: string;
  memberId?: string;
  contributionType: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  receiptNumber?: string;
  contributedAt: string;
  notes?: string;
}

export const contributionsApi = {
  list: (
    tenantSlug: string,
    params: { branchId?: string; memberId?: string; contributionType?: string; dateFrom?: string; dateTo?: string; page?: number } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.memberId) qs.set('memberId', params.memberId);
    if (params.contributionType) qs.set('contributionType', params.contributionType);
    if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params.dateTo) qs.set('dateTo', params.dateTo);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', '20');
    return apiRequest<Contribution[]>(`/contributions?${qs.toString()}`, { tenantSlug, auth: true });
  },
  summary: (tenantSlug: string, params: { branchId?: string; dateFrom?: string; dateTo?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params.dateTo) qs.set('dateTo', params.dateTo);
    return apiRequest<ContributionSummary[]>(`/contributions/summary?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, contribution: CreateContributionInput) =>
    apiRequest<Contribution>('/contributions', { method: 'POST', tenantSlug, auth: true, body: contribution }),
  void: (tenantSlug: string, id: string, voidReason: string) =>
    apiRequest<Contribution>(`/contributions/${id}/void`, { method: 'PATCH', tenantSlug, auth: true, body: { voidReason } }),
};

export interface AttendanceRecord {
  id: string;
  branchId: string;
  memberId: string | null;
  serviceType: string;
  attendanceMethod: string | null;
  headcount: number;
  attendedAt: string;
  recordedByUserId: string | null;
  notes: string | null;
}

export interface AttendanceSummary {
  serviceType: string;
  totalAttendance: number;
  recordCount: number;
}

export interface CreateAttendanceRecordInput {
  branchId: string;
  memberId?: string;
  serviceType: string;
  attendanceMethod?: string;
  headcount?: number;
  attendedAt: string;
  notes?: string;
}

export const attendanceApi = {
  list: (
    tenantSlug: string,
    params: { branchId?: string; memberId?: string; serviceType?: string; dateFrom?: string; dateTo?: string; page?: number } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.memberId) qs.set('memberId', params.memberId);
    if (params.serviceType) qs.set('serviceType', params.serviceType);
    if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params.dateTo) qs.set('dateTo', params.dateTo);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', '20');
    return apiRequest<AttendanceRecord[]>(`/attendance-records?${qs.toString()}`, { tenantSlug, auth: true });
  },
  summary: (tenantSlug: string, params: { branchId?: string; dateFrom?: string; dateTo?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params.dateTo) qs.set('dateTo', params.dateTo);
    return apiRequest<AttendanceSummary[]>(`/attendance-records/summary?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, record: CreateAttendanceRecordInput) =>
    apiRequest<AttendanceRecord>('/attendance-records', { method: 'POST', tenantSlug, auth: true, body: record }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<AttendanceRecord>(`/attendance-records/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export interface Ministry {
  id: string;
  branchId: string | null;
  name: string;
  ministryType: string | null;
  description: string | null;
  isActive: boolean;
}

export interface MinistryMembership {
  id: string;
  ministryId: string;
  memberId: string;
  role: string;
  joinedAt: string | null;
  isActive: boolean;
}

export interface CreateMinistryInput {
  name: string;
  branchId?: string;
  ministryType?: string;
  description?: string;
}

export const ministriesApi = {
  list: (tenantSlug: string, params: { branchId?: string; ministryType?: string; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.ministryType) qs.set('ministryType', params.ministryType);
    if (params.search) qs.set('search', params.search);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<Ministry[]>(`/ministries?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, ministry: CreateMinistryInput) =>
    apiRequest<Ministry>('/ministries', { method: 'POST', tenantSlug, auth: true, body: ministry }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<Ministry>(`/ministries/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export const ministryMembershipsApi = {
  list: (tenantSlug: string, params: { ministryId?: string; memberId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.ministryId) qs.set('ministryId', params.ministryId);
    if (params.memberId) qs.set('memberId', params.memberId);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<MinistryMembership[]>(`/ministry-memberships?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, membership: { ministryId: string; memberId: string; role?: string }) =>
    apiRequest<MinistryMembership>('/ministry-memberships', { method: 'POST', tenantSlug, auth: true, body: membership }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<MinistryMembership>(`/ministry-memberships/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export interface Notification {
  id: string;
  channel: 'email' | 'sms' | 'push';
  recipientMemberId: string | null;
  recipient: string;
  subject: string | null;
  body: string;
  status: 'queued' | 'sent' | 'failed';
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface CreateNotificationInput {
  channel: 'email' | 'sms' | 'push';
  memberId?: string;
  recipient?: string;
  subject?: string;
  body: string;
}

export const notificationsApi = {
  list: (tenantSlug: string, params: { channel?: string; status?: string; memberId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.channel) qs.set('channel', params.channel);
    if (params.status) qs.set('status', params.status);
    if (params.memberId) qs.set('memberId', params.memberId);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<Notification[]>(`/notifications?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, notification: CreateNotificationInput) =>
    apiRequest<Notification>('/notifications', { method: 'POST', tenantSlug, auth: true, body: notification }),
};

export interface CustomFieldOption {
  key: string;
  label: string;
}

export interface CustomFieldDefinition {
  id: string;
  entityType: string;
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options: CustomFieldOption[] | null;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface CreateCustomFieldDefinitionInput {
  entityType: string;
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: CustomFieldOption[];
  isRequired?: boolean;
  sortOrder?: number;
}

export const customFieldDefinitionsApi = {
  list: (tenantSlug: string, params: { entityType?: string; includeInactive?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.entityType) qs.set('entityType', params.entityType);
    if (params.includeInactive) qs.set('includeInactive', 'true');
    return apiRequest<CustomFieldDefinition[]>(`/custom-field-definitions?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, definition: CreateCustomFieldDefinitionInput) =>
    apiRequest<CustomFieldDefinition>('/custom-field-definitions', { method: 'POST', tenantSlug, auth: true, body: definition }),
  deactivate: (tenantSlug: string, id: string) =>
    apiRequest<CustomFieldDefinition>(`/custom-field-definitions/${id}/deactivate`, { method: 'PATCH', tenantSlug, auth: true }),
  reactivate: (tenantSlug: string, id: string) =>
    apiRequest<CustomFieldDefinition>(`/custom-field-definitions/${id}/reactivate`, { method: 'PATCH', tenantSlug, auth: true }),
};

export interface Event {
  id: string;
  branchId: string | null;
  name: string;
  eventType: string | null;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  isActive: boolean;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  memberId: string | null;
  guestName: string | null;
  guestContact: string | null;
  status: 'registered' | 'attended' | 'cancelled';
  notes: string | null;
}

export interface CreateEventInput {
  name: string;
  branchId?: string;
  eventType?: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt?: string;
  capacity?: number;
}

export const eventsApi = {
  list: (tenantSlug: string, params: { branchId?: string; eventType?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.eventType) qs.set('eventType', params.eventType);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<Event[]>(`/events?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, event: CreateEventInput) =>
    apiRequest<Event>('/events', { method: 'POST', tenantSlug, auth: true, body: event }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<Event>(`/events/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export const eventRegistrationsApi = {
  list: (tenantSlug: string, params: { eventId?: string; memberId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.eventId) qs.set('eventId', params.eventId);
    if (params.memberId) qs.set('memberId', params.memberId);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<EventRegistration[]>(`/event-registrations?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, registration: { eventId: string; memberId?: string; guestName?: string; guestContact?: string }) =>
    apiRequest<EventRegistration>('/event-registrations', { method: 'POST', tenantSlug, auth: true, body: registration }),
  update: (tenantSlug: string, id: string, body: { status?: string; notes?: string }) =>
    apiRequest<EventRegistration>(`/event-registrations/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<EventRegistration>(`/event-registrations/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export interface Staff {
  id: string;
  memberId: string | null;
  branchId: string | null;
  firstName: string;
  lastName: string;
  position: string | null;
  department: string | null;
  employmentType: string;
  employmentStatus: 'active' | 'on_leave' | 'terminated';
  hireDate: string | null;
  baseSalary: string | null;
  salaryCurrency: string | null;
  isActive: boolean;
}

export interface PayrollPayment {
  id: string;
  staffId: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: string;
  deductions: string;
  netAmount: string;
  currency: string;
  status: 'pending' | 'paid' | 'cancelled';
  paidAt: string | null;
  cancelReason: string | null;
  notes: string | null;
}

export interface CreateStaffInput {
  firstName: string;
  lastName: string;
  memberId?: string;
  branchId?: string;
  position?: string;
  department?: string;
  employmentType: string;
  baseSalary?: number;
  salaryCurrency?: string;
}

export const staffApi = {
  list: (tenantSlug: string, params: { branchId?: string; employmentStatus?: string; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.employmentStatus) qs.set('employmentStatus', params.employmentStatus);
    if (params.search) qs.set('search', params.search);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<Staff[]>(`/staff?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, staff: CreateStaffInput) =>
    apiRequest<Staff>('/staff', { method: 'POST', tenantSlug, auth: true, body: staff }),
  update: (tenantSlug: string, id: string, body: Partial<CreateStaffInput> & { employmentStatus?: string }) =>
    apiRequest<Staff>(`/staff/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<Staff>(`/staff/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export const payrollApi = {
  list: (tenantSlug: string, params: { staffId?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.staffId) qs.set('staffId', params.staffId);
    if (params.status) qs.set('status', params.status);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<PayrollPayment[]>(`/payroll-payments?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (
    tenantSlug: string,
    payment: { staffId: string; periodStart: string; periodEnd: string; grossAmount: number; deductions?: number; notes?: string },
  ) => apiRequest<PayrollPayment>('/payroll-payments', { method: 'POST', tenantSlug, auth: true, body: payment }),
  markPaid: (tenantSlug: string, id: string) =>
    apiRequest<PayrollPayment>(`/payroll-payments/${id}/mark-paid`, { method: 'PATCH', tenantSlug, auth: true }),
  cancel: (tenantSlug: string, id: string, cancelReason: string) =>
    apiRequest<PayrollPayment>(`/payroll-payments/${id}/cancel`, { method: 'PATCH', tenantSlug, auth: true, body: { cancelReason } }),
};

export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  onboardedAt: string | null;
}

export const tenantApi = {
  getProfile: (tenantSlug: string) => apiRequest<TenantProfile>('/tenant', { tenantSlug, auth: true }),
  completeOnboarding: (tenantSlug: string, body: { headquartersName?: string; headquartersType?: string }) =>
    apiRequest<TenantProfile>('/tenant/onboarding/complete', { method: 'PATCH', tenantSlug, auth: true, body }),
};
