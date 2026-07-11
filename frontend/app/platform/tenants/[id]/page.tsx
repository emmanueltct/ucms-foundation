'use client';

// app/platform/tenants/[id]/page.tsx
// Platform Admin's detail view for one church: lifecycle actions
// (deactivate/reactivate, restore if soft-deleted), a health snapshot, and
// cross-tenant user management (force-verify-email/force-activate/
// force-reset-password) for when the church's own admin is unreachable or
// locked out.

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getCurrentPlatformAdmin,
  platformTenantsApi,
  platformTenantAdminApi,
  PlatformTenant,
  TenantHealth,
  AppUser,
} from '../../../../lib/api';
import { PlatformTopBar } from '@/components/platform-top-bar';

export default function PlatformTenantDetailPage() {
  const params = useParams<{ id: string }>();
  const tenantId = params.id;
  const router = useRouter();

  const [checkedAuth, setCheckedAuth] = useState(false);
  const [tenant, setTenant] = useState<PlatformTenant | null>(null);
  const [health, setHealth] = useState<TenantHealth | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetHandoff, setResetHandoff] = useState<{ email: string; temporaryPassword: string } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [tenantRes, healthRes, usersRes] = await Promise.all([
      platformTenantsApi.get(tenantId),
      platformTenantAdminApi.health(tenantId),
      platformTenantAdminApi.listUsers(tenantId),
    ]);
    if (tenantRes.success && tenantRes.data) setTenant(tenantRes.data);
    else setError(tenantRes.error?.message ?? 'Could not load this church.');
    if (healthRes.success && healthRes.data) setHealth(healthRes.data);
    if (usersRes.success && usersRes.data) setUsers(usersRes.data);
    setLoading(false);
  }

  useEffect(() => {
    if (!getCurrentPlatformAdmin()) {
      router.push('/platform/login');
      return;
    }
    setCheckedAuth(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function handleToggleActive() {
    if (!tenant) return;
    setBusy(true);
    const res = tenant.isActive ? await platformTenantsApi.deactivate(tenant.id) : await platformTenantsApi.reactivate(tenant.id);
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not update church status.');
    setBusy(false);
  }

  async function handleForceVerify(userId: string) {
    setBusy(true);
    const res = await platformTenantAdminApi.forceVerifyEmail(tenantId, userId);
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not verify email.');
    setBusy(false);
  }

  async function handleForceActivate(userId: string) {
    setBusy(true);
    const res = await platformTenantAdminApi.forceActivate(tenantId, userId);
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not activate account.');
    setBusy(false);
  }

  async function handleForceResetPassword(user: AppUser) {
    if (!confirm(`Reset ${user.email}'s password? Their current sessions will be signed out.`)) return;
    setBusy(true);
    setResetHandoff(null);
    const res = await platformTenantAdminApi.forcePasswordReset(tenantId, user.id);
    if (res.success && res.data) setResetHandoff({ email: user.email, temporaryPassword: res.data.temporaryPassword });
    else setError(res.error?.message ?? 'Could not reset this password.');
    setBusy(false);
  }

  if (!checkedAuth) return null;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <PlatformTopBar />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/platform/tenants" className="text-xs text-slate-400 hover:text-slate-600">
          ← All churches
        </Link>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
        ) : !tenant ? (
          <div className="py-12 text-center text-sm text-slate-400">{error ?? 'Church not found.'}</div>
        ) : (
          <>
            <header className="mt-4 mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Platform Admin</p>
                <h1 className="font-serif text-3xl text-[#1E2A44]">{tenant.name}</h1>
                <p className="text-sm text-slate-500 mt-1">{tenant.slug} · {tenant.subscriptionPlan}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    tenant.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tenant.isActive ? 'Active' : 'Inactive'}
                </span>
                <button
                  onClick={handleToggleActive}
                  disabled={busy}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                >
                  {tenant.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </header>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-6">{error}</div>}

            {resetHandoff && (
              <div className="mb-6 rounded-xl border border-[#C9A24B]/40 bg-[#C9A24B]/10 px-5 py-4">
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

            {health && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
                {[
                  { label: 'Members', value: health.members },
                  { label: 'Active staff', value: health.activeStaff },
                  { label: 'Branches', value: health.branches },
                  { label: 'Upcoming events', value: health.upcomingEvents },
                  { label: 'Giving (MTD)', value: health.contributionsThisMonth },
                  { label: 'Attendance (30d)', value: health.attendanceLast30Days },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                    <p className="text-lg font-serif text-[#1E2A44]">{stat.value}</p>
                    <p className="text-[11px] text-slate-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            <h2 className="font-serif text-lg text-[#1E2A44] mb-3">Users</h2>
            <p className="text-xs text-slate-500 mb-4">
              For when this church&apos;s own admin is unreachable or locked out — force-verify their email or
              force-activate their account directly.
            </p>
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
              {users.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">No users yet.</div>
              ) : (
                users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-slate-400">
                        {u.email}
                        {!u.emailVerifiedAt && <span className="ml-1.5 text-amber-600">· unverified</span>}
                        {!u.isActive && <span className="ml-1.5 text-slate-400">· inactive</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!u.emailVerifiedAt && (
                        <button
                          onClick={() => handleForceVerify(u.id)}
                          disabled={busy}
                          className="text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                        >
                          Force-verify email
                        </button>
                      )}
                      {!u.isActive && (
                        <button
                          onClick={() => handleForceActivate(u.id)}
                          disabled={busy}
                          className="text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                        >
                          Force-activate
                        </button>
                      )}
                      <button
                        onClick={() => handleForceResetPassword(u)}
                        disabled={busy}
                        className="text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                      >
                        Force-reset password
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
