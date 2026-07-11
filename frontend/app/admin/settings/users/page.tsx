'use client';

// app/admin/settings/users/page.tsx
// User management: assign each user's roles and, for organizational
// visibility roll-up (see BranchScopeService on the backend), which branch
// they're assigned to. Leaving a user unassigned keeps them church-wide —
// the default, so existing single-branch churches are unaffected.

import { useEffect, useState } from 'react';
import { branchesApi, Branch, getCurrentTenant, rolesApi, Role, usersApi, AppUser } from '../../../../lib/api';

export default function UsersAdminPage() {
  const tenant = getCurrentTenant();
  const tenantSlug = tenant?.slug ?? '';

  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [usersRes, rolesRes, branchesRes] = await Promise.all([
      usersApi.list(tenantSlug),
      rolesApi.list(tenantSlug),
      branchesApi.list(tenantSlug),
    ]);
    if (usersRes.success && usersRes.data) setUsers(usersRes.data);
    else setError(usersRes.error?.message ?? 'Could not load users.');
    if (rolesRes.success && rolesRes.data) setRoles(rolesRes.data);
    if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
    setLoading(false);
  }

  useEffect(() => {
    if (tenantSlug) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  async function handleBranchChange(user: AppUser, branchId: string) {
    setSavingId(user.id);
    const res = await usersApi.update(tenantSlug, user.id, { assignedBranchId: branchId || null });
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not update branch assignment.');
    setSavingId(null);
  }

  async function handleRoleToggle(user: AppUser, roleId: string) {
    const current = new Set(user.userRoles.map((ur) => ur.role.id));
    if (current.has(roleId)) current.delete(roleId);
    else current.add(roleId);
    if (current.size === 0) return; // backend requires at least one role

    setSavingId(user.id);
    const res = await usersApi.assignRoles(tenantSlug, user.id, Array.from(current));
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not update roles.');
    setSavingId(null);
  }

  async function handleToggleActive(user: AppUser) {
    setSavingId(user.id);
    const res = user.isActive ? await usersApi.deactivate(tenantSlug, user.id) : await usersApi.activate(tenantSlug, user.id);
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not update account status.');
    setSavingId(null);
  }

  async function handleForceVerify(user: AppUser) {
    setSavingId(user.id);
    const res = await usersApi.forceVerifyEmail(tenantSlug, user.id);
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not verify email.');
    setSavingId(null);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Center</p>
        <h1 className="font-serif text-3xl text-[#1E2A44]">Users</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Assign roles and, optionally, a branch — assigning a branch scopes what that user sees across Members,
          Contributions, Attendance, and other roll-up-aware lists to that branch and its descendants.
        </p>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : users.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">No users yet.</div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="px-4 py-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {user.email}
                    {!user.emailVerifiedAt && <span className="ml-1.5 text-amber-600">· unverified</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {!user.emailVerifiedAt && (
                    <button
                      onClick={() => handleForceVerify(user)}
                      disabled={savingId === user.id}
                      className="text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                    >
                      Force-verify email
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleActive(user)}
                    disabled={savingId === user.id}
                    className="text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                  >
                    {user.isActive ? 'Deactivate' : 'Force-activate'}
                  </button>
                  <select
                    value={user.assignedBranchId ?? ''}
                    onChange={(e) => handleBranchChange(user, e.target.value)}
                    disabled={savingId === user.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                  >
                    <option value="">Church-wide (unassigned)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((role) => {
                  const active = user.userRoles.some((ur) => ur.role.id === role.id);
                  return (
                    <button
                      key={role.id}
                      onClick={() => handleRoleToggle(user, role.id)}
                      disabled={savingId === user.id}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? 'bg-[#1E2A44] text-white border-[#1E2A44]'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {role.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
