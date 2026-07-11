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

// Session is persisted to localStorage (in addition to the in-memory copies
// below) so a page refresh, direct URL navigation, or new tab doesn't lose
// an otherwise-still-valid session. This trades a small XSS exposure risk
// for a real app being usable at all across reloads — a real production
// deployment handling sensitive church data should instead persist tokens
// in an httpOnly cookie set by a server action / route handler, which no
// page JS (malicious or not) can ever read.
const STORAGE_KEY = 'ucms.session';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  tenant: { slug: string; name: string } | null;
  user: AuthUser | null;
}

function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null) {
  if (typeof window === 'undefined') return;
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private browsing, artifact preview, ...) — session just won't survive a reload there.
  }
}

const stored = readStoredSession();
let inMemoryAccessToken: string | null = stored?.accessToken ?? null;
let inMemoryRefreshToken: string | null = stored?.refreshToken ?? null;
let currentTenant: { slug: string; name: string } | null = stored?.tenant ?? null;
let currentUser: AuthUser | null = stored?.user ?? null;

export function setSession(accessToken: string, refreshToken: string, tenant?: { slug: string; name: string }, user?: AuthUser) {
  inMemoryAccessToken = accessToken;
  inMemoryRefreshToken = refreshToken;
  if (tenant) currentTenant = tenant;
  if (user) currentUser = user;
  writeStoredSession({ accessToken: inMemoryAccessToken, refreshToken: inMemoryRefreshToken, tenant: currentTenant, user: currentUser });
}

export function clearSession() {
  inMemoryAccessToken = null;
  inMemoryRefreshToken = null;
  currentTenant = null;
  currentUser = null;
  writeStoredSession(null);
}

/** Which church workspace the current session is scoped to — set by login/switch-tenant. */
export function getCurrentTenant(): { slug: string; name: string } | null {
  return currentTenant;
}

/** The signed-in user's own profile (roles/permissions/MFA status) — set by login/switch-tenant. */
export function getCurrentUser(): AuthUser | null {
  return currentUser;
}

/** Lets a page update just the MFA flag after enroll/disable, without a full re-login. */
export function updateCurrentUserMfaStatus(mfaEnabled: boolean) {
  if (!currentUser) return;
  currentUser = { ...currentUser, mfaEnabled };
  if (inMemoryAccessToken && inMemoryRefreshToken) {
    writeStoredSession({ accessToken: inMemoryAccessToken, refreshToken: inMemoryRefreshToken, tenant: currentTenant, user: currentUser });
  }
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

/** For endpoints that accept multipart/form-data (a file upload) rather than JSON. */
export async function multipartRequest<T>(
  path: string,
  opts: { method?: 'POST' | 'PATCH'; tenantSlug: string; form: FormData },
): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = { 'X-Tenant-Slug': opts.tenantSlug };
  if (inMemoryAccessToken) headers.Authorization = `Bearer ${inMemoryAccessToken}`;

  const res = await fetch(`${API_BASE}${path}`, { method: opts.method ?? 'POST', headers, body: opts.form });
  return (await res.json()) as ApiEnvelope<T>;
}

/**
 * For export endpoints, which return a raw file (CSV/XLSX/PDF) rather than
 * the standard JSON envelope. Triggers a normal browser download using the
 * filename the server set in Content-Disposition, falling back to a
 * generated one if that header is ever missing.
 */
export async function downloadFile(path: string, tenantSlug: string, fallbackFilename: string): Promise<{ success: boolean; error?: string }> {
  const headers: Record<string, string> = { 'X-Tenant-Slug': tenantSlug };
  if (inMemoryAccessToken) headers.Authorization = `Bearer ${inMemoryAccessToken}`;

  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    return { success: false, error: `Download failed (${res.status}).` };
  }

  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch?.[1] ?? fallbackFilename;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { success: true };
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
  emailVerifiedAt: string | null;
}

export interface AuthTenant {
  slug: string;
  name: string;
}

export interface AuthSuccessResult {
  user: AuthUser;
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  tenant: AuthTenant;
}

export interface WorkspaceOption {
  slug: string;
  name: string;
}

/** Returned instead of AuthSuccessResult when the same email+password matches more than one church workspace. */
export interface WorkspaceSelectionResult {
  requiresWorkspaceSelection: true;
  workspaces: WorkspaceOption[];
}

export type LoginResult = AuthSuccessResult | WorkspaceSelectionResult;

export const authApi = {
  /**
   * `tenantSlug` is optional — omit it to route by email+password alone
   * across every church workspace (see AuthService.login on the backend).
   */
  login: (email: string, password: string, tenantSlug?: string, mfaCode?: string) =>
    apiRequest<LoginResult>('/auth/login', {
      method: 'POST',
      tenantSlug: tenantSlug ?? '',
      body: { email, password, mfaCode },
    }),
  // Not tenant-scoped — the person may not remember which church workspace they're in.
  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>('/auth/forgot-password', { method: 'POST', tenantSlug: '', body: { email } }),
  resetPassword: (token: string, newPassword: string) =>
    apiRequest<{ message: string }>('/auth/reset-password', { method: 'POST', tenantSlug: '', body: { token, newPassword } }),
  /** `currentTenantSlug` names the workspace the caller is already signed into; `targetTenantSlug` is where they're switching to. */
  switchTenant: (currentTenantSlug: string, targetTenantSlug: string) =>
    apiRequest<AuthSuccessResult>('/auth/switch-tenant', {
      method: 'POST',
      tenantSlug: currentTenantSlug,
      auth: true,
      body: { tenantSlug: targetTenantSlug },
    }),
  listWorkspaces: (currentTenantSlug: string) =>
    apiRequest<WorkspaceOption[]>('/auth/workspaces', { tenantSlug: currentTenantSlug, auth: true }),
  // Not tenant-scoped — the verification token itself resolves the tenant.
  verifyEmail: (token: string) =>
    apiRequest<{ message: string }>('/auth/verify-email', { method: 'POST', tenantSlug: '', body: { token } }),
  resendVerification: (tenantSlug: string) =>
    apiRequest<{ message: string }>('/auth/resend-verification', { method: 'POST', tenantSlug, auth: true }),
  listSessions: (tenantSlug: string) =>
    apiRequest<AuthSession[]>('/auth/sessions', { tenantSlug, auth: true }),
  revokeSession: (tenantSlug: string, id: string) =>
    apiRequest<{ message: string }>(`/auth/sessions/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
  loginHistory: (tenantSlug: string) =>
    apiRequest<LoginHistoryEntry[]>('/auth/login-history', { tenantSlug, auth: true }),
};

export interface AuthSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface LoginHistoryEntry {
  id: string;
  action: 'auth.login' | 'auth.login_failed' | 'auth.logout' | 'auth.switch_tenant';
  ipAddress: string | null;
  metadata: { userAgent?: string; reason?: string } | null;
  createdAt: string;
}

export interface MfaSetupResult {
  secret: string;
  otpAuthUrl: string;
  qrCodeDataUrl: string;
}

export const mfaApi = {
  setup: (tenantSlug: string) =>
    apiRequest<MfaSetupResult>('/auth/mfa/setup', { method: 'POST', tenantSlug, auth: true }),
  enable: (tenantSlug: string, code: string) =>
    apiRequest<{ message: string }>('/auth/mfa/enable', { method: 'POST', tenantSlug, auth: true, body: { code } }),
  disable: (tenantSlug: string, code: string) =>
    apiRequest<{ message: string }>('/auth/mfa/disable', { method: 'POST', tenantSlug, auth: true, body: { code } }),
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

export interface RolePermission {
  permission: { id: string; code: string; module: string; description: string };
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  rolePermissions: RolePermission[];
}

export const rolesApi = {
  list: (tenantSlug: string) => apiRequest<Role[]>('/roles', { tenantSlug, auth: true }),
  get: (tenantSlug: string, id: string) => apiRequest<Role>(`/roles/${id}`, { tenantSlug, auth: true }),
  create: (tenantSlug: string, body: { name: string; description?: string; permissionCodes?: string[] }) =>
    apiRequest<Role>('/roles', { method: 'POST', tenantSlug, auth: true, body }),
  update: (tenantSlug: string, id: string, body: Partial<{ name: string; description: string; permissionCodes: string[] }>) =>
    apiRequest<Role>(`/roles/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) => apiRequest<Role>(`/roles/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export interface Permission {
  id: string;
  code: string;
  module: string;
  description: string;
}

export const permissionsApi = {
  list: (tenantSlug: string, module?: string) =>
    apiRequest<Permission[]>(`/permissions${module ? `?module=${encodeURIComponent(module)}` : ''}`, { tenantSlug, auth: true }),
  modules: (tenantSlug: string) => apiRequest<string[]>('/permissions/modules', { tenantSlug, auth: true }),
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

export interface MemberActivity {
  id: string;
  memberId: string;
  activityType: string;
  activityDate: string;
  outcome: string | null;
  notes: string | null;
  performedByUserId: string | null;
  createdAt: string;
  customFields: Record<string, unknown>;
}

export interface CreateMemberActivityInput {
  activityType: string;
  activityDate?: string;
  outcome?: string;
  notes?: string;
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
  remove: (tenantSlug: string, id: string, reason: string) =>
    apiRequest<Member>(`/members/${id}`, { method: 'DELETE', tenantSlug, auth: true, body: { reason } }),
  /** Public, unauthenticated list of active branches for the self-registration picker. */
  registerBranchOptions: (tenantSlug: string) =>
    apiRequest<{ id: string; name: string; branchType: string | null; parentBranchId: string | null }[]>('/members/register/branches', { tenantSlug }),
  /** Public, unauthenticated self-registration — always creates a pending member. */
  registerPublic: (
    tenantSlug: string,
    body: {
      branchId: string;
      firstName: string;
      lastName: string;
      gender?: string;
      dateOfBirth?: string;
      phone?: string;
      email?: string;
      address?: string;
    },
  ) => apiRequest<Member>('/members/register', { method: 'POST', tenantSlug, body }),
  approve: (tenantSlug: string, id: string, reason: string) =>
    apiRequest<Member>(`/members/${id}/approve`, { method: 'PATCH', tenantSlug, auth: true, body: { reason } }),
  reject: (tenantSlug: string, id: string, reason: string) =>
    apiRequest<Member>(`/members/${id}/reject`, { method: 'PATCH', tenantSlug, auth: true, body: { reason } }),
  addActivity: (tenantSlug: string, memberId: string, activity: CreateMemberActivityInput) =>
    apiRequest<MemberActivity>(`/members/${memberId}/activities`, { method: 'POST', tenantSlug, auth: true, body: activity }),
  listActivities: (tenantSlug: string, memberId: string) =>
    apiRequest<MemberActivity[]>(`/members/${memberId}/activities`, { tenantSlug, auth: true }),
  export: (
    tenantSlug: string,
    format: ExportFormat,
    params: { search?: string; branchId?: string; familyId?: string; membershipStatus?: string } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.familyId) qs.set('familyId', params.familyId);
    if (params.membershipStatus) qs.set('membershipStatus', params.membershipStatus);
    qs.set('format', format);
    return downloadFile(`/members/export?${qs.toString()}`, tenantSlug, `members.${format}`);
  },
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

export type CustomFieldType =
  | 'text'
  | 'richtext'
  | 'number'
  | 'date'
  | 'time'
  | 'boolean'
  | 'select'
  | 'radio'
  | 'multiselect'
  | 'email'
  | 'phone'
  | 'address'
  | 'gps'
  | 'file'
  | 'image'
  | 'video'
  | 'audio'
  | 'signature'
  | 'lookup';

export interface CustomFieldValidationRules {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface CustomFieldDefinition {
  id: string;
  entityType: string;
  fieldKey: string;
  label: string;
  fieldType: CustomFieldType;
  options: CustomFieldOption[] | null;
  isRequired: boolean;
  sortOrder: number;
  section: string | null;
  visibleToRoleNames: string[];
  validationRules: CustomFieldValidationRules | null;
  lookupEntityType: string | null;
  isActive: boolean;
}

export interface CreateCustomFieldDefinitionInput {
  entityType: string;
  fieldKey: string;
  label: string;
  fieldType: CustomFieldType;
  options?: CustomFieldOption[];
  isRequired?: boolean;
  sortOrder?: number;
  section?: string;
  visibleToRoleNames?: string[];
  validationRules?: CustomFieldValidationRules;
  lookupEntityType?: string;
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

export interface ReportOverview {
  members: number;
  activeStaff: number;
  branches: number;
  upcomingEvents: number;
  contributionsThisMonth: number;
  attendanceLast30Days: number;
}

export interface MonthBucket {
  month: string;
  total: number;
  count: number;
}

export interface KeyBucket {
  key: string;
  total: number;
  count: number;
}

export interface MembershipGrowthBucket extends MonthBucket {
  cumulativeActive: number;
}

export interface MemberActivityTimelineEntry {
  kind: 'ministry' | 'small_group' | 'event' | 'attendance' | 'contribution' | 'activity';
  date: string;
  label: string;
  detail?: string;
}

export interface MemberActivityHistory {
  member: { id: string; firstName: string; lastName: string; membershipNumber: string | null };
  ministries: { ministryId: string; role: string; joinedAt: string | null; ministry: { name: string } }[];
  smallGroups: { smallGroupId: string; role: string; joinedAt: string | null; smallGroup: { name: string } }[];
  eventsAttended: { eventId: string; status: string; event: { name: string; startsAt: string } }[];
  attendance: { totalCount: number; recent: { serviceType: string; attendedAt: string; headcount: number }[] };
  contributions: {
    totalAmount: number;
    totalCount: number;
    recent: { contributionType: string; amount: number; currency: string; contributedAt: string }[];
  };
  activities: MemberActivity[];
  timeline: MemberActivityTimelineEntry[];
}

export const reportsApi = {
  overview: (tenantSlug: string) => apiRequest<ReportOverview>('/reports/overview', { tenantSlug, auth: true }),
  financeSummary: (tenantSlug: string, params: { dateFrom?: string; dateTo?: string; branchId?: string } = {}) =>
    apiRequest<{ byMonth: MonthBucket[]; byType: KeyBucket[] }>(`/reports/finance-summary?${reportRangeQs(params)}`, {
      tenantSlug,
      auth: true,
    }),
  attendanceTrends: (tenantSlug: string, params: { dateFrom?: string; dateTo?: string; branchId?: string } = {}) =>
    apiRequest<{ byMonth: MonthBucket[]; byServiceType: KeyBucket[] }>(
      `/reports/attendance-trends?${reportRangeQs(params)}`,
      { tenantSlug, auth: true },
    ),
  membershipGrowth: (tenantSlug: string, params: { dateFrom?: string; dateTo?: string; branchId?: string } = {}) =>
    apiRequest<{ newMembersByMonth: MembershipGrowthBucket[] }>(`/reports/membership-growth?${reportRangeQs(params)}`, {
      tenantSlug,
      auth: true,
    }),
  payrollSummary: (tenantSlug: string, params: { dateFrom?: string; dateTo?: string } = {}) =>
    apiRequest<{ byMonth: MonthBucket[]; byDepartment: KeyBucket[] }>(`/reports/payroll-summary?${reportRangeQs(params)}`, {
      tenantSlug,
      auth: true,
    }),
  memberActivityHistory: (tenantSlug: string, memberId: string) =>
    apiRequest<MemberActivityHistory>(`/reports/members/${memberId}/activity-history`, { tenantSlug, auth: true }),
  exportFinanceSummary: (tenantSlug: string, format: ExportFormat, params: { dateFrom?: string; dateTo?: string; branchId?: string } = {}) =>
    downloadFile(`/reports/finance-summary/export?${reportRangeQs(params)}&format=${format}`, tenantSlug, `finance-summary.${format}`),
  exportAttendanceTrends: (tenantSlug: string, format: ExportFormat, params: { dateFrom?: string; dateTo?: string; branchId?: string } = {}) =>
    downloadFile(`/reports/attendance-trends/export?${reportRangeQs(params)}&format=${format}`, tenantSlug, `attendance-trends.${format}`),
  exportMembershipGrowth: (tenantSlug: string, format: ExportFormat, params: { dateFrom?: string; dateTo?: string; branchId?: string } = {}) =>
    downloadFile(`/reports/membership-growth/export?${reportRangeQs(params)}&format=${format}`, tenantSlug, `membership-growth.${format}`),
  exportPayrollSummary: (tenantSlug: string, format: ExportFormat, params: { dateFrom?: string; dateTo?: string } = {}) =>
    downloadFile(`/reports/payroll-summary/export?${reportRangeQs(params)}&format=${format}`, tenantSlug, `payroll-summary.${format}`),
};

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

function reportRangeQs(params: { dateFrom?: string; dateTo?: string; branchId?: string }): string {
  const qs = new URLSearchParams();
  if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params.dateTo) qs.set('dateTo', params.dateTo);
  if (params.branchId) qs.set('branchId', params.branchId);
  return qs.toString();
}

export interface UploadedFileValue {
  key: string;
  filename: string;
  size: number;
  contentType: string;
}

export interface Asset {
  id: string;
  branchId: string | null;
  name: string;
  assetCategory: string;
  assetTag: string | null;
  condition: string | null;
  status: 'in_use' | 'in_storage' | 'under_maintenance' | 'disposed' | 'lost';
  location: string | null;
  acquisitionDate: string | null;
  acquisitionCost: string | null;
  currentValue: string | null;
  currency: string | null;
  notes: string | null;
  isActive: boolean;
  customFields: Record<string, unknown>;
}

export interface CreateAssetInput {
  name: string;
  assetCategory: string;
  branchId?: string;
  assetTag?: string;
  condition?: string;
  status?: string;
  location?: string;
  acquisitionDate?: string;
  acquisitionCost?: number;
  currentValue?: number;
  currency?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export const assetsApi = {
  list: (tenantSlug: string, params: { branchId?: string; assetCategory?: string; status?: string; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.assetCategory) qs.set('assetCategory', params.assetCategory);
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<Asset[]>(`/assets?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, asset: CreateAssetInput) =>
    apiRequest<Asset>('/assets', { method: 'POST', tenantSlug, auth: true, body: asset }),
  update: (tenantSlug: string, id: string, body: Partial<Omit<CreateAssetInput, 'assetCategory'>>) =>
    apiRequest<Asset>(`/assets/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<Asset>(`/assets/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
  uploadDocument: (tenantSlug: string, assetId: string, fieldKey: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return multipartRequest<UploadedFileValue>(`/assets/${assetId}/documents?fieldKey=${encodeURIComponent(fieldKey)}`, {
      tenantSlug,
      form,
    });
  },
  getDocumentDownloadUrl: (tenantSlug: string, assetId: string, fieldKey: string) =>
    apiRequest<{ url: string; filename: string }>(`/assets/${assetId}/documents/${fieldKey}/download`, {
      tenantSlug,
      auth: true,
    }),
};

export interface AppUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  assignedBranchId: string | null;
  assignedBranch: { id: string; name: string } | null;
  userRoles: { role: { id: string; name: string } }[];
}

export const usersApi = {
  list: (tenantSlug: string) => apiRequest<AppUser[]>('/users?page=1&pageSize=100', { tenantSlug, auth: true }),
  create: (
    tenantSlug: string,
    body: { email: string; password: string; firstName: string; lastName: string; roleIds?: string[]; assignedBranchId?: string },
  ) => apiRequest<AppUser>('/users', { method: 'POST', tenantSlug, auth: true, body }),
  update: (tenantSlug: string, id: string, body: Partial<{ firstName: string; lastName: string; assignedBranchId: string | null }>) =>
    apiRequest<AppUser>(`/users/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  assignRoles: (tenantSlug: string, id: string, roleIds: string[]) =>
    apiRequest<AppUser>(`/users/${id}/roles`, { method: 'PATCH', tenantSlug, auth: true, body: { roleIds } }),
};

export interface Visitor {
  id: string;
  branchId: string | null;
  visitorGroupId: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  visitDate: string;
  source: string | null;
  invitedByMemberId: string | null;
  assignedToUserId: string | null;
  status: 'new' | 'contacted' | 'scheduled_visit' | 'joined' | 'no_response' | 'closed';
  convertedMemberId: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface VisitorGroup {
  id: string;
  branchId: string | null;
  name: string;
  groupType: string;
  visitDate: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  expectedSize: number | null;
  source: string | null;
  assignedToUserId: string | null;
  status: 'new' | 'contacted' | 'scheduled_visit' | 'no_response' | 'closed';
  notes: string | null;
  isActive: boolean;
}

export interface VisitorActivity {
  id: string;
  visitorId: string | null;
  visitorGroupId: string | null;
  activityType: string;
  activityDate: string;
  outcome: string | null;
  notes: string | null;
  performedByUserId: string | null;
  createdAt: string;
  customFields: Record<string, unknown>;
}

export interface CreateVisitorInput {
  firstName: string;
  lastName: string;
  branchId?: string;
  visitorGroupId?: string;
  phone?: string;
  email?: string;
  address?: string;
  visitDate: string;
  source?: string;
  invitedByMemberId?: string;
  assignedToUserId?: string;
  notes?: string;
}

export interface CreateVisitorGroupInput {
  name: string;
  groupType: string;
  branchId?: string;
  visitDate: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  expectedSize?: number;
  source?: string;
  assignedToUserId?: string;
  notes?: string;
}

export interface CreateVisitorActivityInput {
  activityType: string;
  activityDate?: string;
  outcome?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export const visitorsApi = {
  list: (
    tenantSlug: string,
    params: { branchId?: string; visitorGroupId?: string; status?: string; assignedToUserId?: string; search?: string } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.visitorGroupId) qs.set('visitorGroupId', params.visitorGroupId);
    if (params.status) qs.set('status', params.status);
    if (params.assignedToUserId) qs.set('assignedToUserId', params.assignedToUserId);
    if (params.search) qs.set('search', params.search);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<Visitor[]>(`/visitors?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, visitor: CreateVisitorInput) =>
    apiRequest<Visitor>('/visitors', { method: 'POST', tenantSlug, auth: true, body: visitor }),
  /** `reason` is required by the backend whenever `status` is included in the payload. */
  update: (tenantSlug: string, id: string, body: Partial<CreateVisitorInput> & { status?: string; reason?: string }) =>
    apiRequest<Visitor>(`/visitors/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<Visitor>(`/visitors/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
  convert: (tenantSlug: string, id: string, memberId: string, reason: string) =>
    apiRequest<Visitor>(`/visitors/${id}/convert`, { method: 'PATCH', tenantSlug, auth: true, body: { memberId, reason } }),
  addActivity: (tenantSlug: string, visitorId: string, activity: CreateVisitorActivityInput) =>
    apiRequest<VisitorActivity>(`/visitors/${visitorId}/activities`, { method: 'POST', tenantSlug, auth: true, body: activity }),
  listActivities: (tenantSlug: string, visitorId: string) =>
    apiRequest<VisitorActivity[]>(`/visitors/${visitorId}/activities`, { tenantSlug, auth: true }),
  export: (
    tenantSlug: string,
    format: ExportFormat,
    params: { branchId?: string; status?: string; assignedToUserId?: string; search?: string } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.status) qs.set('status', params.status);
    if (params.assignedToUserId) qs.set('assignedToUserId', params.assignedToUserId);
    if (params.search) qs.set('search', params.search);
    qs.set('format', format);
    return downloadFile(`/visitors/export?${qs.toString()}`, tenantSlug, `visitors.${format}`);
  },
};

export const visitorGroupsApi = {
  list: (tenantSlug: string, params: { branchId?: string; groupType?: string; status?: string; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.groupType) qs.set('groupType', params.groupType);
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<VisitorGroup[]>(`/visitor-groups?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, group: CreateVisitorGroupInput) =>
    apiRequest<VisitorGroup>('/visitor-groups', { method: 'POST', tenantSlug, auth: true, body: group }),
  update: (tenantSlug: string, id: string, body: Partial<CreateVisitorGroupInput> & { status?: string }) =>
    apiRequest<VisitorGroup>(`/visitor-groups/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<VisitorGroup>(`/visitor-groups/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
  listMembers: (tenantSlug: string, id: string) =>
    apiRequest<Visitor[]>(`/visitor-groups/${id}/members`, { tenantSlug, auth: true }),
  addActivity: (tenantSlug: string, groupId: string, activity: CreateVisitorActivityInput) =>
    apiRequest<VisitorActivity>(`/visitor-groups/${groupId}/activities`, { method: 'POST', tenantSlug, auth: true, body: activity }),
  listActivities: (tenantSlug: string, groupId: string) =>
    apiRequest<VisitorActivity[]>(`/visitor-groups/${groupId}/activities`, { tenantSlug, auth: true }),
};

export interface ChurchDocument {
  id: string;
  branchId: string | null;
  title: string;
  description: string | null;
  category: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  uploadedByUserId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  replacedByUserId: string | null;
  createdAt: string;
}

export const documentsApi = {
  list: (tenantSlug: string, params: { branchId?: string; category?: string; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.category) qs.set('category', params.category);
    if (params.search) qs.set('search', params.search);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<ChurchDocument[]>(`/documents?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, doc: { title: string; category: string; description?: string; branchId?: string; file: File }) => {
    const form = new FormData();
    form.append('title', doc.title);
    form.append('category', doc.category);
    if (doc.description) form.append('description', doc.description);
    if (doc.branchId) form.append('branchId', doc.branchId);
    form.append('file', doc.file);
    return multipartRequest<ChurchDocument>('/documents', { tenantSlug, form });
  },
  /** Uploads several files at once, each becoming its own document sharing category/description/branch. */
  createBatch: (tenantSlug: string, batch: { category: string; titlePrefix?: string; description?: string; branchId?: string; files: File[] }) => {
    const form = new FormData();
    form.append('category', batch.category);
    if (batch.titlePrefix) form.append('titlePrefix', batch.titlePrefix);
    if (batch.description) form.append('description', batch.description);
    if (batch.branchId) form.append('branchId', batch.branchId);
    batch.files.forEach((file) => form.append('files', file));
    return multipartRequest<ChurchDocument[]>('/documents/batch', { tenantSlug, form });
  },
  update: (tenantSlug: string, id: string, body: { title?: string; category?: string; description?: string; branchId?: string }) =>
    apiRequest<ChurchDocument>(`/documents/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  replaceFile: (tenantSlug: string, id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return multipartRequest<ChurchDocument>(`/documents/${id}/file`, { method: 'PATCH', tenantSlug, form });
  },
  remove: (tenantSlug: string, id: string) =>
    apiRequest<ChurchDocument>(`/documents/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
  getDownloadUrl: (tenantSlug: string, id: string) =>
    apiRequest<{ url: string; filename: string }>(`/documents/${id}/download`, { tenantSlug, auth: true }),
  listVersions: (tenantSlug: string, id: string) =>
    apiRequest<DocumentVersion[]>(`/documents/${id}/versions`, { tenantSlug, auth: true }),
  getVersionDownloadUrl: (tenantSlug: string, id: string, versionId: string) =>
    apiRequest<{ url: string; filename: string }>(`/documents/${id}/versions/${versionId}/download`, { tenantSlug, auth: true }),
};

export interface SmallGroup {
  id: string;
  branchId: string | null;
  name: string;
  groupType: string | null;
  description: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  location: string | null;
  capacity: number | null;
  minAge: number | null;
  maxAge: number | null;
  isActive: boolean;
}

export interface SmallGroupMembership {
  id: string;
  smallGroupId: string;
  memberId: string;
  role: string;
  joinedAt: string | null;
  isActive: boolean;
}

export interface CreateSmallGroupInput {
  name: string;
  branchId?: string;
  groupType?: string;
  description?: string;
  meetingDay?: string;
  meetingTime?: string;
  location?: string;
  capacity?: number;
  minAge?: number;
  maxAge?: number;
}

export const smallGroupsApi = {
  list: (tenantSlug: string, params: { branchId?: string; groupType?: string; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.groupType) qs.set('groupType', params.groupType);
    if (params.search) qs.set('search', params.search);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<SmallGroup[]>(`/small-groups?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, group: CreateSmallGroupInput) =>
    apiRequest<SmallGroup>('/small-groups', { method: 'POST', tenantSlug, auth: true, body: group }),
  update: (tenantSlug: string, id: string, body: Partial<CreateSmallGroupInput>) =>
    apiRequest<SmallGroup>(`/small-groups/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<SmallGroup>(`/small-groups/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export const smallGroupMembershipsApi = {
  list: (tenantSlug: string, params: { smallGroupId?: string; memberId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.smallGroupId) qs.set('smallGroupId', params.smallGroupId);
    if (params.memberId) qs.set('memberId', params.memberId);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<SmallGroupMembership[]>(`/small-group-memberships?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, membership: { smallGroupId: string; memberId: string; role?: string }) =>
    apiRequest<SmallGroupMembership>('/small-group-memberships', { method: 'POST', tenantSlug, auth: true, body: membership }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<SmallGroupMembership>(`/small-group-memberships/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export interface ApprovalStep {
  id: string;
  stepOrder: number;
  label: string;
  approverRoleName: string | null;
  approverPermissionCode: string | null;
}

export interface ApprovalWorkflow {
  id: string;
  entityType: string;
  name: string;
  isActive: boolean;
  steps: ApprovalStep[];
}

export const approvalWorkflowsApi = {
  list: (tenantSlug: string, entityType?: string) =>
    apiRequest<ApprovalWorkflow[]>(`/approval-workflows${entityType ? `?entityType=${entityType}` : ''}`, { tenantSlug, auth: true }),
  get: (tenantSlug: string, id: string) => apiRequest<ApprovalWorkflow>(`/approval-workflows/${id}`, { tenantSlug, auth: true }),
  create: (
    tenantSlug: string,
    body: { entityType: string; name: string; steps: { label: string; approverRoleName?: string; approverPermissionCode?: string }[] },
  ) => apiRequest<ApprovalWorkflow>('/approval-workflows', { method: 'POST', tenantSlug, auth: true, body }),
  update: (tenantSlug: string, id: string, body: Partial<{ name: string; isActive: boolean }>) =>
    apiRequest<ApprovalWorkflow>(`/approval-workflows/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<{ id: string }>(`/approval-workflows/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export interface HierarchyRequirement {
  id: string;
  parentBranchType: string;
  childBranchType: string;
  kind: string;
  label: string;
  description: string | null;
  frequency: string;
  dueDayOfPeriod: number | null;
  approvalWorkflowId: string | null;
  notifyRoleNames: string[];
  isActive: boolean;
}

export interface HierarchyRequirementSubmission {
  id: string;
  requirementId: string;
  branchId: string;
  periodLabel: string;
  status: string;
  attachedDocumentIds: string[];
  submittedByUserId: string | null;
  submittedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export const hierarchyRequirementsApi = {
  list: (tenantSlug: string, params: { parentBranchType?: string; childBranchType?: string; kind?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.parentBranchType) qs.set('parentBranchType', params.parentBranchType);
    if (params.childBranchType) qs.set('childBranchType', params.childBranchType);
    if (params.kind) qs.set('kind', params.kind);
    return apiRequest<HierarchyRequirement[]>(`/hierarchy-requirements?${qs.toString()}`, { tenantSlug, auth: true });
  },
  forBranch: (tenantSlug: string, branchId: string) =>
    apiRequest<HierarchyRequirement[]>(`/hierarchy-requirements/for-branch/${branchId}`, { tenantSlug, auth: true }),
  create: (
    tenantSlug: string,
    body: {
      parentBranchType: string;
      childBranchType: string;
      kind: string;
      label: string;
      description?: string;
      frequency?: string;
      dueDayOfPeriod?: number;
      approvalWorkflowId?: string;
      notifyRoleNames?: string[];
    },
  ) => apiRequest<HierarchyRequirement>('/hierarchy-requirements', { method: 'POST', tenantSlug, auth: true, body }),
  update: (tenantSlug: string, id: string, body: Partial<{ label: string; description: string; isActive: boolean }>) =>
    apiRequest<HierarchyRequirement>(`/hierarchy-requirements/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<HierarchyRequirement>(`/hierarchy-requirements/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
  submissionsForRequirement: (tenantSlug: string, requirementId: string) =>
    apiRequest<HierarchyRequirementSubmission[]>(`/hierarchy-requirements/${requirementId}/submissions`, { tenantSlug, auth: true }),
  submissionsForBranch: (tenantSlug: string, branchId: string) =>
    apiRequest<HierarchyRequirementSubmission[]>(`/hierarchy-requirements/submissions/branch/${branchId}`, { tenantSlug, auth: true }),
  createSubmission: (tenantSlug: string, requirementId: string, branchId: string, body: { periodLabel?: string; notes?: string } = {}) =>
    apiRequest<HierarchyRequirementSubmission>(`/hierarchy-requirements/${requirementId}/submissions?branchId=${branchId}`, {
      method: 'POST',
      tenantSlug,
      auth: true,
      body,
    }),
  submit: (tenantSlug: string, submissionId: string, body: { attachedDocumentIds?: string[]; notes?: string } = {}) =>
    apiRequest<HierarchyRequirementSubmission>(`/hierarchy-requirements/submissions/${submissionId}/submit`, {
      method: 'PATCH',
      tenantSlug,
      auth: true,
      body,
    }),
  approve: (tenantSlug: string, submissionId: string, reason: string) =>
    apiRequest<HierarchyRequirementSubmission>(`/hierarchy-requirements/submissions/${submissionId}/approve`, {
      method: 'PATCH',
      tenantSlug,
      auth: true,
      body: { reason },
    }),
  reject: (tenantSlug: string, submissionId: string, reason: string) =>
    apiRequest<HierarchyRequirementSubmission>(`/hierarchy-requirements/submissions/${submissionId}/reject`, {
      method: 'PATCH',
      tenantSlug,
      auth: true,
      body: { reason },
    }),
};

export interface DynamicModuleDefinition {
  id: string;
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  attachableToEntityTypes: string[];
  statuses: string[];
  approvalWorkflowId: string | null;
  showInNav: boolean;
  isActive: boolean;
}

export interface DynamicModuleRecord {
  id: string;
  moduleDefinitionId: string;
  attachedToEntityType: string | null;
  attachedToEntityId: string | null;
  status: string;
  title: string | null;
  branchId: string | null;
  parentRecordId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  customFields: Record<string, unknown>;
}

export interface DynamicModuleRecordStatusHistoryEntry {
  id: string;
  recordId: string;
  fromStatus: string | null;
  toStatus: string;
  changedByUserId: string | null;
  reason: string | null;
  createdAt: string;
}

export const dynamicModuleDefinitionsApi = {
  list: (tenantSlug: string, showInNav?: boolean, includeInactive?: boolean) => {
    const qs = new URLSearchParams();
    if (showInNav !== undefined) qs.set('showInNav', String(showInNav));
    if (includeInactive) qs.set('includeInactive', 'true');
    const query = qs.toString();
    return apiRequest<DynamicModuleDefinition[]>(`/dynamic-modules${query ? `?${query}` : ''}`, { tenantSlug, auth: true });
  },
  getByKey: (tenantSlug: string, key: string) =>
    apiRequest<DynamicModuleDefinition>(`/dynamic-modules/by-key/${key}`, { tenantSlug, auth: true }),
  get: (tenantSlug: string, id: string) => apiRequest<DynamicModuleDefinition>(`/dynamic-modules/${id}`, { tenantSlug, auth: true }),
  create: (
    tenantSlug: string,
    body: {
      key: string;
      label: string;
      description?: string;
      icon?: string;
      attachableToEntityTypes?: string[];
      statuses?: string[];
      approvalWorkflowId?: string;
      showInNav?: boolean;
    },
  ) => apiRequest<DynamicModuleDefinition>('/dynamic-modules', { method: 'POST', tenantSlug, auth: true, body }),
  update: (tenantSlug: string, id: string, body: Partial<{ label: string; description: string; statuses: string[]; showInNav: boolean; isActive: boolean }>) =>
    apiRequest<DynamicModuleDefinition>(`/dynamic-modules/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) => apiRequest<DynamicModuleDefinition>(`/dynamic-modules/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export const dynamicModuleRecordsApi = {
  list: (tenantSlug: string, moduleDefinitionId: string, params: { attachedToEntityType?: string; attachedToEntityId?: string; status?: string; branchId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.attachedToEntityType) qs.set('attachedToEntityType', params.attachedToEntityType);
    if (params.attachedToEntityId) qs.set('attachedToEntityId', params.attachedToEntityId);
    if (params.status) qs.set('status', params.status);
    if (params.branchId) qs.set('branchId', params.branchId);
    return apiRequest<DynamicModuleRecord[]>(`/dynamic-modules/${moduleDefinitionId}/records?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (
    tenantSlug: string,
    moduleDefinitionId: string,
    body: { attachedToEntityType?: string; attachedToEntityId?: string; title?: string; branchId?: string; parentRecordId?: string; customFields?: Record<string, unknown> },
  ) => apiRequest<DynamicModuleRecord>(`/dynamic-modules/${moduleDefinitionId}/records`, { method: 'POST', tenantSlug, auth: true, body }),
  update: (
    tenantSlug: string,
    moduleDefinitionId: string,
    id: string,
    body: { title?: string; branchId?: string; parentRecordId?: string; customFields?: Record<string, unknown> },
  ) => apiRequest<DynamicModuleRecord>(`/dynamic-modules/${moduleDefinitionId}/records/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  descendants: (tenantSlug: string, moduleDefinitionId: string, id: string) =>
    apiRequest<DynamicModuleRecord[]>(`/dynamic-modules/${moduleDefinitionId}/records/${id}/descendants`, { tenantSlug, auth: true }),
  remove: (tenantSlug: string, moduleDefinitionId: string, id: string) =>
    apiRequest<DynamicModuleRecord>(`/dynamic-modules/${moduleDefinitionId}/records/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
  changeStatus: (tenantSlug: string, moduleDefinitionId: string, id: string, toStatus: string, reason: string) =>
    apiRequest<DynamicModuleRecord>(`/dynamic-modules/${moduleDefinitionId}/records/${id}/status`, {
      method: 'PATCH',
      tenantSlug,
      auth: true,
      body: { toStatus, reason },
    }),
  statusHistory: (tenantSlug: string, moduleDefinitionId: string, id: string) =>
    apiRequest<DynamicModuleRecordStatusHistoryEntry[]>(`/dynamic-modules/${moduleDefinitionId}/records/${id}/status-history`, { tenantSlug, auth: true }),
  summary: (tenantSlug: string, moduleDefinitionId: string) =>
    apiRequest<{ byStatus: { status: string; count: number }[]; byBranch: { branchId: string | null; count: number }[] }>(
      `/dynamic-modules/${moduleDefinitionId}/records/summary`,
      { tenantSlug, auth: true },
    ),
};

export interface EntityMembership {
  id: string;
  attachedToEntityType: string;
  attachedToEntityId: string;
  memberId: string;
  role: string;
  joinedAt: string | null;
  isActive: boolean;
}

export const entityMembershipsApi = {
  list: (tenantSlug: string, params: { attachedToEntityType?: string; attachedToEntityId?: string; memberId?: string; role?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.attachedToEntityType) qs.set('attachedToEntityType', params.attachedToEntityType);
    if (params.attachedToEntityId) qs.set('attachedToEntityId', params.attachedToEntityId);
    if (params.memberId) qs.set('memberId', params.memberId);
    if (params.role) qs.set('role', params.role);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    return apiRequest<EntityMembership[]>(`/entity-memberships?${qs.toString()}`, { tenantSlug, auth: true });
  },
  create: (tenantSlug: string, body: { attachedToEntityType: string; attachedToEntityId: string; memberId: string; role?: string }) =>
    apiRequest<EntityMembership>('/entity-memberships', { method: 'POST', tenantSlug, auth: true, body }),
  update: (tenantSlug: string, id: string, body: Partial<{ role: string; isActive: boolean }>) =>
    apiRequest<EntityMembership>(`/entity-memberships/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) => apiRequest<EntityMembership>(`/entity-memberships/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  themeConfig: Record<string, string> | null;
  customDomain: string | null;
  onboardedAt: string | null;
}

export type MenuItemTargetType = 'module' | 'entity' | 'report' | 'dashboard' | 'customPage' | 'workflow';

export interface MenuItem {
  id: string;
  parentMenuItemId: string | null;
  label: string;
  icon: string | null;
  sortOrder: number;
  targetType: MenuItemTargetType;
  targetKey: string;
  visibleToRoleNames: string[];
  visibleToBranchId: string | null;
  isActive: boolean;
}

export interface CreateMenuItemInput {
  label: string;
  icon?: string;
  sortOrder?: number;
  parentMenuItemId?: string;
  targetType: MenuItemTargetType;
  targetKey: string;
  visibleToRoleNames?: string[];
  visibleToBranchId?: string;
}

export const menuItemsApi = {
  list: (tenantSlug: string) => apiRequest<MenuItem[]>('/menu-items', { tenantSlug, auth: true }),
  forCurrentUser: (tenantSlug: string) => apiRequest<MenuItem[]>('/menu-items/for-current-user', { tenantSlug, auth: true }),
  create: (tenantSlug: string, body: CreateMenuItemInput) =>
    apiRequest<MenuItem>('/menu-items', { method: 'POST', tenantSlug, auth: true, body }),
  update: (tenantSlug: string, id: string, body: Partial<CreateMenuItemInput & { isActive: boolean }>) =>
    apiRequest<MenuItem>(`/menu-items/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) => apiRequest<{ id: string }>(`/menu-items/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export interface NotificationTemplate {
  id: string;
  channel: 'email' | 'sms' | 'push';
  key: string;
  subject: string | null;
  body: string;
  isActive: boolean;
}

export const notificationTemplatesApi = {
  list: (tenantSlug: string) => apiRequest<NotificationTemplate[]>('/notification-templates', { tenantSlug, auth: true }),
  create: (tenantSlug: string, body: { channel: 'email' | 'sms' | 'push'; key: string; subject?: string; body: string }) =>
    apiRequest<NotificationTemplate>('/notification-templates', { method: 'POST', tenantSlug, auth: true, body }),
  update: (tenantSlug: string, id: string, body: Partial<{ subject: string; body: string; isActive: boolean }>) =>
    apiRequest<NotificationTemplate>(`/notification-templates/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<{ id: string }>(`/notification-templates/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export interface NumberingSequence {
  id: string;
  key: string;
  prefix: string;
  nextValue: number;
  padding: number;
}

export const numberingSequencesApi = {
  list: (tenantSlug: string) => apiRequest<NumberingSequence[]>('/numbering-sequences', { tenantSlug, auth: true }),
  create: (tenantSlug: string, body: { key: string; prefix?: string; nextValue?: number; padding?: number }) =>
    apiRequest<NumberingSequence>('/numbering-sequences', { method: 'POST', tenantSlug, auth: true, body }),
  update: (tenantSlug: string, id: string, body: Partial<{ prefix: string; nextValue: number; padding: number }>) =>
    apiRequest<NumberingSequence>(`/numbering-sequences/${id}`, { method: 'PATCH', tenantSlug, auth: true, body }),
  remove: (tenantSlug: string, id: string) =>
    apiRequest<{ id: string }>(`/numbering-sequences/${id}`, { method: 'DELETE', tenantSlug, auth: true }),
};

export const tenantApi = {
  getProfile: (tenantSlug: string) => apiRequest<TenantProfile>('/tenant', { tenantSlug, auth: true }),
  completeOnboarding: (tenantSlug: string, body: { headquartersName?: string; headquartersType?: string }) =>
    apiRequest<TenantProfile>('/tenant/onboarding/complete', { method: 'PATCH', tenantSlug, auth: true, body }),
  updateBranding: (tenantSlug: string, body: { logoUrl?: string; themeConfig?: Record<string, string>; customDomain?: string }) =>
    apiRequest<TenantProfile>('/tenant/branding', { method: 'PATCH', tenantSlug, auth: true, body }),
};

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  previousValue: unknown;
  newValue: unknown;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

export const auditLogsApi = {
  list: (tenantSlug: string, params: { action?: string; entityType?: string; userId?: string; page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.action) qs.set('action', params.action);
    if (params.entityType) qs.set('entityType', params.entityType);
    if (params.userId) qs.set('userId', params.userId);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', '50');
    return apiRequest<AuditLogEntry[]>(`/audit-logs?${qs.toString()}`, { tenantSlug, auth: true });
  },
};

// ----------------------------------------------------------------------------
// PLATFORM ADMIN
// Separate token store from the tenant session above — a platform admin has
// no tenant at all, so it can't reuse setSession/apiRequest (which always
// sends X-Tenant-Slug and reads the tenant-user token). Kept in its own
// localStorage key so a platform-admin tab and a church-admin tab in the
// same browser never clobber each other's session.
// ----------------------------------------------------------------------------

const PLATFORM_STORAGE_KEY = 'ucms.platformSession';

export interface PlatformAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface StoredPlatformSession {
  accessToken: string;
  admin: PlatformAdmin;
}

function readStoredPlatformSession(): StoredPlatformSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PLATFORM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPlatformSession) : null;
  } catch {
    return null;
  }
}

function writeStoredPlatformSession(session: StoredPlatformSession | null) {
  if (typeof window === 'undefined') return;
  try {
    if (session) window.localStorage.setItem(PLATFORM_STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(PLATFORM_STORAGE_KEY);
  } catch {
    // Storage unavailable — session just won't survive a reload there.
  }
}

const storedPlatform = readStoredPlatformSession();
let platformAccessToken: string | null = storedPlatform?.accessToken ?? null;
let currentPlatformAdmin: PlatformAdmin | null = storedPlatform?.admin ?? null;

export function setPlatformSession(accessToken: string, admin: PlatformAdmin) {
  platformAccessToken = accessToken;
  currentPlatformAdmin = admin;
  writeStoredPlatformSession({ accessToken, admin });
}

export function clearPlatformSession() {
  platformAccessToken = null;
  currentPlatformAdmin = null;
  writeStoredPlatformSession(null);
}

export function getCurrentPlatformAdmin(): PlatformAdmin | null {
  return currentPlatformAdmin;
}

async function platformApiRequest<T>(
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; auth?: boolean } = {},
): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false && platformAccessToken) headers.Authorization = `Bearer ${platformAccessToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  return (await res.json()) as ApiEnvelope<T>;
}

export interface PlatformAuthResult {
  admin: PlatformAdmin;
  accessToken: string;
  expiresIn: number;
}

export const platformAuthApi = {
  login: (email: string, password: string) =>
    platformApiRequest<PlatformAuthResult>('/platform/auth/login', { method: 'POST', auth: false, body: { email, password } }),
};

export interface PlatformTenant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  language: string;
  timezone: string;
  subscriptionPlan: string;
  isActive: boolean;
  onboardedAt: string | null;
  createdAt: string;
}

export interface CreatePlatformTenantInput {
  name: string;
  slug: string;
  currency?: string;
  language?: string;
  timezone?: string;
  subscriptionPlan?: string;
  /** If given, bootstraps a "Church Administrator" role + user and returns a one-time temporary password to hand off. */
  adminEmail?: string;
}

export interface CreatePlatformTenantResult {
  tenant: PlatformTenant;
  temporaryPassword: string | null;
}

export const platformTenantsApi = {
  list: (search = '') =>
    platformApiRequest<PlatformTenant[]>(`/platform/tenants?pageSize=100${search ? `&search=${encodeURIComponent(search)}` : ''}`, { auth: true }),
  get: (id: string) => platformApiRequest<PlatformTenant>(`/platform/tenants/${id}`, { auth: true }),
  create: (body: CreatePlatformTenantInput) =>
    platformApiRequest<CreatePlatformTenantResult>('/platform/tenants', { method: 'POST', auth: true, body }),
  deactivate: (id: string) =>
    platformApiRequest<PlatformTenant>(`/platform/tenants/${id}/deactivate`, { method: 'PATCH', auth: true }),
};
