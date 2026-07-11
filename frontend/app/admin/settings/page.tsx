'use client';

// app/admin/settings/page.tsx
// The Configuration Center — one place linking out to every admin
// configuration surface (Branches, Dynamic Modules, Custom Fields, Lookup
// Values, Security), plus two tabs that live directly here: Branding and
// the Audit Log viewer. Existing settings pages keep their own URLs (no
// links break) — this is a navigational hub, not a relocation.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  ListPlus,
  Puzzle,
  ShieldCheck,
  SlidersHorizontal,
  Palette,
  ScrollText,
  Users,
  KeyRound,
  Workflow,
  Menu as MenuIcon,
} from 'lucide-react';
import { auditLogsApi, AuditLogEntry, getCurrentTenant, tenantApi, TenantProfile } from '../../../lib/api';

const SECTIONS = [
  { href: '/admin/branches', label: 'Branches', description: 'Organizational hierarchy — the church tree.', icon: Building2 },
  { href: '/admin/settings/roles', label: 'Roles & Permissions', description: 'Custom roles and what each can do.', icon: KeyRound },
  { href: '/admin/settings/users', label: 'Users', description: 'Assign roles and branch scope per user.', icon: Users },
  { href: '/admin/settings/dynamic-modules', label: 'Dynamic Modules', description: 'Create no-code modules and entities.', icon: Puzzle },
  { href: '/admin/settings/workflows', label: 'Workflow Builder', description: 'Ordered approval chains for anything.', icon: Workflow },
  { href: '/admin/settings/menus', label: 'Menu Builder', description: 'Configure navigation without code.', icon: MenuIcon },
  { href: '/admin/settings/custom-fields', label: 'Form Builder', description: 'Custom fields for any record type.', icon: ListPlus },
  { href: '/admin/config', label: 'Lookup Values', description: 'Ministries, categories, and other tenant-defined lists.', icon: SlidersHorizontal },
  { href: '/admin/settings/security', label: 'Security', description: 'Sessions, devices, and login history.', icon: ShieldCheck },
];

type Tab = 'overview' | 'branding' | 'audit';

export default function ConfigurationCenterPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const tenant = getCurrentTenant();

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Center</p>
        <h1 className="font-serif text-3xl text-[#1E2A44]">Everything, in one place</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Every configuration surface for this church — modules, forms, roles, branding, and the audit trail — starts
          here, so nothing is scattered across unrelated pages.
        </p>
      </header>

      <div className="flex gap-2 mb-8 border-b border-slate-200">
        {(['overview', 'branding', 'audit'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-[#1E2A44] text-[#1E2A44]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'overview' ? 'Overview' : t === 'branding' ? 'Branding' : 'Audit Log'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid sm:grid-cols-2 gap-4">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-xl border border-slate-200 bg-white p-5 hover:border-[#1E2A44]/30 hover:shadow-sm transition-all"
            >
              <s.icon className="h-5 w-5 text-[#C9A24B] mb-2" />
              <p className="text-sm font-medium text-[#1E2A44]">{s.label}</p>
              <p className="text-xs text-slate-500 mt-1">{s.description}</p>
            </Link>
          ))}
        </div>
      )}

      {tab === 'branding' && tenant && <BrandingTab tenantSlug={tenant.slug} />}
      {tab === 'audit' && tenant && <AuditLogTab tenantSlug={tenant.slug} />}
    </div>
  );
}

function BrandingTab({ tenantSlug }: { tenantSlug: string }) {
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1E2A44');
  const [secondaryColor, setSecondaryColor] = useState('#C9A24B');
  const [customDomain, setCustomDomain] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tenantApi.getProfile(tenantSlug).then((res) => {
      if (res.success && res.data) {
        setProfile(res.data);
        setLogoUrl(res.data.logoUrl ?? '');
        setPrimaryColor(res.data.themeConfig?.primaryColor ?? '#1E2A44');
        setSecondaryColor(res.data.themeConfig?.secondaryColor ?? '#C9A24B');
        setCustomDomain(res.data.customDomain ?? '');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await tenantApi.updateBranding(tenantSlug, {
      logoUrl: logoUrl || undefined,
      themeConfig: { primaryColor, secondaryColor },
      customDomain: customDomain || undefined,
    });
    if (res.success && res.data) {
      setProfile(res.data);
      setMessage('Branding updated.');
    } else {
      setError(res.error?.message ?? 'Could not update branding.');
    }
    setSaving(false);
  }

  if (!profile) return <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>;

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-8">
      <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Logo URL</label>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://cdn.example.com/logo.png"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Primary color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-9 rounded border border-slate-200" />
              <input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Secondary color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-9 rounded border border-slate-200" />
              <input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Custom domain</label>
          <input
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="church.example.com"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
          />
        </div>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: '#1E2A44' }}
        >
          {saving ? 'Saving…' : 'Save branding'}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-medium text-slate-500 mb-3">Live preview</p>
        <div className="rounded-lg overflow-hidden border border-slate-200">
          <div className="h-14 flex items-center gap-2 px-4" style={{ backgroundColor: primaryColor }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded object-cover" />
            ) : (
              <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: secondaryColor }}>
                <Palette className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <span className="text-sm font-serif text-white">{profile.name}</span>
          </div>
          <div className="p-4 bg-[#F7F6F2]">
            <div className="h-2 w-2/3 rounded mb-2" style={{ backgroundColor: secondaryColor }} />
            <div className="h-2 w-1/2 rounded bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditLogTab({ tenantSlug }: { tenantSlug: string }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    auditLogsApi.list(tenantSlug).then((res) => {
      if (res.success && res.data) {
        setEntries(res.data);
      } else {
        setError(res.error?.message ?? 'Could not load the audit log.');
      }
      setLoading(false);
    });
  }, [tenantSlug]);

  return (
    <div>
      <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
        <ScrollText className="h-3.5 w-3.5" /> Every mandatory-reason action and login event, most recent first.
      </p>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">No audit log entries yet.</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-800">{entry.action}</p>
                <p className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {entry.entityType}
                {entry.entityId ? ` #${entry.entityId.slice(0, 8)}` : ''} ·{' '}
                {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'System'}
              </p>
              {entry.reason && <p className="text-xs text-slate-500 mt-1 italic">&ldquo;{entry.reason}&rdquo;</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
