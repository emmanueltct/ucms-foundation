'use client';

// app/platform/tenants/page.tsx
// The Platform Admin's tenant-provisioning dashboard: register a new
// denomination/church from the top level, hand it to one person (the
// bootstrapped admin's one-time temporary password), and see every
// workspace provisioned so far. Once that admin signs in, their church's
// own hierarchy becomes visible on their /admin/branches page.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCurrentPlatformAdmin,
  platformTenantsApi,
  PlatformTenant,
} from '../../../lib/api';
import { Button } from '@/components/ui/button';
import { PlatformTopBar } from '@/components/platform-top-bar';

export default function PlatformTenantsPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [handoff, setHandoff] = useState<{ tenant: PlatformTenant; temporaryPassword: string; adminEmail: string } | null>(null);

  useEffect(() => {
    if (!getCurrentPlatformAdmin()) {
      router.push('/platform/login');
      return;
    }
    setCheckedAuth(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await platformTenantsApi.list();
    if (res.success && res.data) {
      setTenants(res.data);
    } else {
      setError(res.error?.message ?? 'Could not load churches.');
    }
    setLoading(false);
  }

  function slugify(value: string) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setCreating(true);
    setError(null);
    setHandoff(null);

    const submittedAdminEmail = adminEmail.trim();
    const res = await platformTenantsApi.create({
      name: name.trim(),
      slug: slug.trim(),
      adminEmail: submittedAdminEmail || undefined,
    });

    if (res.success && res.data) {
      if (res.data.temporaryPassword) {
        setHandoff({ tenant: res.data.tenant, temporaryPassword: res.data.temporaryPassword, adminEmail: submittedAdminEmail });
      }
      setName('');
      setSlug('');
      setAdminEmail('');
      load();
    } else {
      setError(res.error?.message ?? 'Could not create church.');
    }
    setCreating(false);
  }

  if (!checkedAuth) return null;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <PlatformTopBar />
      <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Platform Admin</p>
        <h1 className="font-serif text-3xl text-[#1E2A44]">Churches &amp; denominations</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Register a new denomination or church from the top level, then hand it off to one person who will manage
          it. Once that admin signs in, they build out their own organizational hierarchy from{' '}
          <span className="font-medium">Branches</span> in their church&apos;s admin panel.
        </p>
      </header>

      {handoff && (
        <div className="mb-8 rounded-xl border border-[#C9A24B]/40 bg-[#C9A24B]/10 px-5 py-4">
          <p className="text-sm font-medium text-[#1E2A44] mb-1">
            &ldquo;{handoff.tenant.name}&rdquo; created — hand these credentials to the person who will manage it
          </p>
          <div className="text-sm text-slate-700 space-y-1 font-mono">
            <p>Email: {handoff.adminEmail}</p>
            <p>Temporary password: <span className="font-semibold">{handoff.temporaryPassword}</span></p>
            <p>Workspace: {handoff.tenant.slug}</p>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            They sign in at <span className="font-medium">/login</span> with this email + password and are asked to
            set a real password and complete onboarding (including their hierarchy) from there.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-[1.1fr_1.4fr] gap-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 h-fit">
          <h2 className="font-serif text-lg text-[#1E2A44] mb-4">Register a new church</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Church / denomination name</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug || slug === slugify(name)) setSlug(slugify(e.target.value));
                }}
                placeholder="Kigali Baptist Church"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Workspace slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="kigali-baptist"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Admin&apos;s email (the one person who will manage it)</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@kigalibaptist.rw"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
              />
              <p className="text-xs text-slate-400 mt-1">Leave blank to just create the workspace without an admin yet.</p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <Button type="submit" disabled={creating} className="w-full bg-[#1E2A44] hover:bg-[#1E2A44]/90">
              {creating ? 'Creating…' : 'Register church'}
            </Button>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : tenants.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No churches registered yet.</div>
          ) : (
            tenants.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-400">
                    {t.slug} · {t.subscriptionPlan} · {t.onboardedAt ? 'onboarded' : 'awaiting onboarding'}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    t.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {t.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
