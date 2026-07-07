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
