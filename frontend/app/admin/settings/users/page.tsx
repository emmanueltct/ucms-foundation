'use client';

// app/admin/settings/users/page.tsx
// User management: assign each user's roles and, for organizational
// visibility roll-up (see BranchScopeService on the backend), which branch
// they're assigned to. Leaving a user unassigned keeps them church-wide —
// the default, so existing single-branch churches are unaffected.

import { useEffect, useState } from 'react';
import {
  branchesApi,
  Branch,
  departmentsApi,
  Department,
  getCurrentTenant,
  getCurrentUser,
  leadershipAppointmentsApi,
  rolesApi,
  Role,
  usersApi,
  AppUser,
  isAccessDeniedResponse,
} from '../../../../lib/api';
import { AccessDenied } from '../../../../components/access-denied';

export default function UsersAdminPage() {
  const tenant = getCurrentTenant();
  const tenantSlug = tenant?.slug ?? '';
  const currentUser = getCurrentUser();
  const canCreateAnyUser = currentUser?.permissions.includes('user.create') ?? false;

  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [myLedBranchIds, setMyLedBranchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resetHandoff, setResetHandoff] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', password: '', assignedBranchId: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [usersRes, rolesRes, branchesRes, departmentsRes, myAppointmentsRes] = await Promise.all([
      usersApi.list(tenantSlug),
      rolesApi.list(tenantSlug),
      branchesApi.list(tenantSlug),
      departmentsApi.list(tenantSlug),
      leadershipAppointmentsApi.mine(tenantSlug),
    ]);
    if (isAccessDeniedResponse(usersRes)) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    if (usersRes.success && usersRes.data) setUsers(usersRes.data);
    else setError(usersRes.error?.message ?? 'Could not load users.');
    if (rolesRes.success && rolesRes.data) setRoles(rolesRes.data);
    if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
    if (departmentsRes.success && departmentsRes.data) setDepartments(departmentsRes.data);
    if (myAppointmentsRes.success && myAppointmentsRes.data) {
      setMyLedBranchIds(myAppointmentsRes.data.filter((a) => a.targetEntityType === 'branch').map((a) => a.targetEntityId));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (tenantSlug) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const registrableBranches = canCreateAnyUser ? branches : branches.filter((b) => myLedBranchIds.includes(b.id));
  const canRegisterUsers = canCreateAnyUser || myLedBranchIds.length > 0;

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!canCreateAnyUser && !newUser.assignedBranchId) {
      setCreateError('Select which of your administered branches to register this user into.');
      return;
    }
    setCreating(true);
    const res = await usersApi.create(tenantSlug, {
      firstName: newUser.firstName.trim(),
      lastName: newUser.lastName.trim(),
      email: newUser.email.trim(),
      password: newUser.password,
      assignedBranchId: newUser.assignedBranchId || undefined,
    });
    if (res.success) {
      setNewUser({ firstName: '', lastName: '', email: '', password: '', assignedBranchId: '' });
      load();
    } else {
      setCreateError(res.error?.message ?? 'Could not register this user.');
    }
    setCreating(false);
  }

  async function handleBranchChange(user: AppUser, branchId: string) {
    setSavingId(user.id);
    const res = await usersApi.update(tenantSlug, user.id, { assignedBranchId: branchId || null });
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not update branch assignment.');
    setSavingId(null);
  }

  async function handleDepartmentChange(user: AppUser, departmentRecordId: string) {
    setSavingId(user.id);
    const res = await usersApi.moveDepartment(tenantSlug, user.id, departmentRecordId || null);
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not update department assignment.');
    setSavingId(null);
  }

  async function handleDepartmentRoleChange(user: AppUser, departmentRole: 'leader' | 'staff') {
    setSavingId(user.id);
    const res = await usersApi.update(tenantSlug, user.id, { departmentRole });
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not update department role.');
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

  async function handleForceResetPassword(user: AppUser) {
    if (!confirm(`Reset ${user.email}'s password? Their current sessions will be signed out, and you'll need to hand them the new temporary password directly.`)) return;
    setSavingId(user.id);
    setResetHandoff(null);
    const res = await usersApi.forcePasswordReset(tenantSlug, user.id);
    if (res.success && res.data) setResetHandoff({ email: user.email, temporaryPassword: res.data.temporaryPassword });
    else setError(res.error?.message ?? 'Could not reset this password.');
    setSavingId(null);
  }

  async function handleToggleLock(user: AppUser) {
    setSavingId(user.id);
    let res;
    if (user.lockedAt) {
      res = await usersApi.unlock(tenantSlug, user.id);
    } else {
      const reason = window.prompt(`Lock ${user.email}'s account? This signs them out everywhere immediately. Optional reason:`);
      if (reason === null) {
        setSavingId(null);
        return;
      }
      res = await usersApi.lock(tenantSlug, user.id, reason || undefined);
    }
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not update the lock on this account.');
    setSavingId(null);
  }

  if (accessDenied) return <AccessDenied />;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Center</p>
        <h1 className="font-serif text-3xl text-[#1E2A44]">Users</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Assign roles and, optionally, a branch and/or a department — assigning a branch scopes what that user sees
          across Members, Contributions, Attendance, and other roll-up-aware lists to that branch and its
          descendants. A department&apos;s Leader can manage its resource assignments and delegate roles to its Staff.
        </p>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

      {resetHandoff && (
        <div className="mb-4 rounded-xl border border-[#C9A24B]/40 bg-[#C9A24B]/10 px-5 py-4">
          <p className="text-sm font-medium text-[#1E2A44] mb-1">
            Password reset for {resetHandoff.email} — hand this to them directly (shown only once)
          </p>
          <p className="text-sm text-slate-700 font-mono">
            Temporary password: <span className="font-semibold">{resetHandoff.temporaryPassword}</span>
          </p>
          <button onClick={() => setResetHandoff(null)} className="text-xs text-slate-500 underline mt-2">
            Dismiss
          </button>
        </div>
      )}

      {canRegisterUsers && (
        <form onSubmit={handleCreateUser} className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
          <p className="text-sm font-medium text-[#1E2A44] mb-3">
            Register a user{!canCreateAnyUser && ' — into a branch you administer'}
          </p>
          {createError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">{createError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-3">
            <input
              value={newUser.firstName}
              onChange={(e) => setNewUser((prev) => ({ ...prev, firstName: e.target.value }))}
              placeholder="First name"
              required
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
            />
            <input
              value={newUser.lastName}
              onChange={(e) => setNewUser((prev) => ({ ...prev, lastName: e.target.value }))}
              placeholder="Last name"
              required
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
            />
            <input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              required
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
            />
            <input
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Temporary password"
              required
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
            />
            <select
              value={newUser.assignedBranchId}
              onChange={(e) => setNewUser((prev) => ({ ...prev, assignedBranchId: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
            >
              <option value="">{canCreateAnyUser ? 'Church-wide (unassigned)' : '— Select your branch —'}</option>
              {registrableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="text-sm font-medium px-4 py-1.5 rounded-full text-white"
            style={{ backgroundColor: '#1E2A44' }}
          >
            {creating ? 'Registering…' : 'Register user'}
          </button>
        </form>
      )}

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
                  {user.lockedAt && (
                    <span
                      className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700"
                      title={user.lockedReason ?? undefined}
                    >
                      Locked
                    </span>
                  )}
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
                  <button
                    onClick={() => handleForceResetPassword(user)}
                    disabled={savingId === user.id}
                    className="text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                  >
                    Force-reset password
                  </button>
                  <button
                    onClick={() => handleToggleLock(user)}
                    disabled={savingId === user.id}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                      user.lockedAt
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {user.lockedAt ? 'Unlock' : 'Lock'}
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
                  <select
                    value={user.assignedDepartmentRecordId ?? ''}
                    onChange={(e) => handleDepartmentChange(user, e.target.value)}
                    disabled={savingId === user.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                  >
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                  {user.assignedDepartmentRecordId && (
                    <select
                      value={user.departmentRole ?? 'staff'}
                      onChange={(e) => handleDepartmentRoleChange(user, e.target.value as 'leader' | 'staff')}
                      disabled={savingId === user.id}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                    >
                      <option value="staff">Staff</option>
                      <option value="leader">Leader</option>
                    </select>
                  )}
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
