'use client';

// app/admin/settings/page.tsx
// The Configuration Center — one place linking out to every admin
// configuration surface (§4): Modules, Dynamic Modules, Custom Fields, Form
// Builder, Entity Builder, Dropdown Values, Lookup Tables, Organizational
// Structure, Departments, Ministries, Roles & Permissions, Security
// Settings, Branding, Reports, Workflows, Notification Templates, and
// System Settings — plus Users and Menu Builder, which predate that list
// and stay available below it. Branding/Notification Templates/Audit
// Log/Numbering Sequences/Trash/Guest Access render as tabs directly on
// this page; everything else is a Link to its own existing route — no
// links break, this is a navigational hub, not a relocation.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  ListPlus,
  Puzzle,
  SlidersHorizontal,
  Palette,
  ScrollText,
  Users,
  KeyRound,
  Workflow,
  Menu as MenuIcon,
  Mail,
  Hash,
  Trash2,
  Briefcase,
  Globe,
  Lock,
  LayoutGrid,
  FormInput,
  ListTree,
  HeartHandshake,
  BarChart3,
  Settings2,
} from 'lucide-react';
import {
  auditLogsApi,
  AuditLogEntry,
  getCurrentTenant,
  notificationTemplatesApi,
  NotificationTemplate,
  numberingSequencesApi,
  NumberingSequence,
  tenantApi,
  TenantProfile,
  trashApi,
  TrashResource,
  TrashItem,
  featureTogglesApi,
  FeatureToggle,
  dynamicModuleDefinitionsApi,
  DynamicModuleDefinition,
} from '../../../lib/api';

type Tab = 'overview' | 'branding' | 'audit' | 'templates' | 'sequences' | 'trash' | 'guestAccess';

interface Section {
  label: string;
  description: string;
  icon: typeof Building2;
  href?: string;
  tab?: Tab;
}

/**
 * The §4 target list — Modules, Dynamic Modules, Custom Fields, Form
 * Builder, Entity Builder, Dropdown Values, Lookup Tables, Organizational
 * Structure, Departments, Ministries, Roles & Permissions, Security
 * Settings, Branding, Reports, Workflows, Notification Templates, System
 * Settings — in that order, each reusing an existing page/tab wherever one
 * already covers it (only Modules, Entity Builder, Lookup Tables, and
 * System Settings are new routes — see
 * docs/dynamic-modules/business-analysis.md for why Entity Builder/Lookup
 * Tables are thin landing pages rather than new mechanisms). Users and Menu
 * Builder aren't part of the §4 list but stay listed below it — nothing
 * that already worked is removed.
 */
const SECTIONS: Section[] = [
  { href: '/admin/settings/modules', label: 'Modules', description: 'Every Dynamic Module this church has, built-in or custom.', icon: LayoutGrid },
  { href: '/admin/settings/dynamic-modules', label: 'Dynamic Modules', description: 'Create no-code modules and entities.', icon: Puzzle },
  { href: '/admin/settings/custom-fields', label: 'Custom Fields', description: 'Custom fields for any record type.', icon: ListPlus },
  { href: '/admin/settings/custom-fields', label: 'Form Builder', description: 'Design forms, reports, and approval flows — no code.', icon: FormInput },
  { href: '/admin/settings/entity-builder', label: 'Entity Builder', description: 'Model a new kind of record this church wants to track.', icon: Settings2 },
  { href: '/admin/config', label: 'Dropdown Values', description: 'Ministries, categories, and other tenant-defined lists.', icon: SlidersHorizontal },
  { href: '/admin/settings/lookup-tables', label: 'Lookup Tables', description: 'Named lists of allowed values used across forms.', icon: ListTree },
  { href: '/admin/branches', label: 'Organizational Structure', description: 'The church tree — branches and sub-branches, any depth.', icon: Building2 },
  { href: '/admin/settings/departments', label: 'Departments', description: 'Finance, HR, or any custom department — with assigned resources.', icon: Briefcase },
  { href: '/admin/ministries', label: 'Ministries', description: 'Choirs, outreach teams, and other ministries.', icon: HeartHandshake },
  { href: '/admin/settings/roles', label: 'Roles & Permissions', description: 'Custom roles and what each can do.', icon: KeyRound },
  { href: '/admin/settings/security-settings', label: 'Security Settings', description: 'Session/token expiration, inactivity auto-logout, and max concurrent sessions for this church.', icon: Lock },
  { tab: 'branding', label: 'Branding', description: 'Logo, theme colors, and custom domain.', icon: Palette },
  { href: '/admin/reports', label: 'Reports', description: 'Trends, exports, and form submission analytics.', icon: BarChart3 },
  { href: '/admin/settings/workflows', label: 'Workflows', description: 'Ordered approval chains for anything.', icon: Workflow },
  { tab: 'templates', label: 'Notification Templates', description: 'Reusable email/SMS templates for automated messages.', icon: Mail },
  { href: '/admin/settings/system', label: 'System Settings', description: 'Default currency, language, and timezone.', icon: Globe },
  { href: '/admin/settings/users', label: 'Users', description: 'Assign roles and branch scope per user.', icon: Users },
  { href: '/admin/settings/menus', label: 'Menu Builder', description: 'Configure navigation without code.', icon: MenuIcon },
];

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  branding: 'Branding',
  audit: 'Audit Log',
  templates: 'Notification Templates',
  sequences: 'Numbering Sequences',
  trash: 'Trash',
  guestAccess: 'Guest Access',
};

const GUEST_ACCESS_VISITOR_REGISTRATION_KEY = 'guest_access.visitor_registration';
const GUEST_ACCESS_MODULES_KEY = 'guest_access.dynamic_modules';

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

      <div className="flex gap-2 mb-8 border-b border-slate-200 flex-wrap">
        {(['overview', 'branding', 'audit', 'templates', 'sequences', 'trash', 'guestAccess'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-[#1E2A44] text-[#1E2A44]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid sm:grid-cols-2 gap-4">
          {SECTIONS.map((s) =>
            s.tab ? (
              <button
                key={s.label}
                onClick={() => setTab(s.tab!)}
                className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-[#1E2A44]/30 hover:shadow-sm transition-all"
              >
                <s.icon className="h-5 w-5 text-[#C9A24B] mb-2" />
                <p className="text-sm font-medium text-[#1E2A44]">{s.label}</p>
                <p className="text-xs text-slate-500 mt-1">{s.description}</p>
              </button>
            ) : (
              <Link
                key={s.label}
                href={s.href!}
                className="rounded-xl border border-slate-200 bg-white p-5 hover:border-[#1E2A44]/30 hover:shadow-sm transition-all"
              >
                <s.icon className="h-5 w-5 text-[#C9A24B] mb-2" />
                <p className="text-sm font-medium text-[#1E2A44]">{s.label}</p>
                <p className="text-xs text-slate-500 mt-1">{s.description}</p>
              </Link>
            ),
          )}
        </div>
      )}

      {tab === 'branding' && tenant && <BrandingTab tenantSlug={tenant.slug} />}
      {tab === 'audit' && tenant && <AuditLogTab tenantSlug={tenant.slug} />}
      {tab === 'templates' && tenant && <NotificationTemplatesTab tenantSlug={tenant.slug} />}
      {tab === 'sequences' && tenant && <NumberingSequencesTab tenantSlug={tenant.slug} />}
      {tab === 'trash' && tenant && <TrashTab tenantSlug={tenant.slug} />}
      {tab === 'guestAccess' && tenant && <GuestAccessTab tenantSlug={tenant.slug} />}
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

function NotificationTemplatesTab({ tenantSlug }: { tenantSlug: string }) {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [channel, setChannel] = useState<'email' | 'sms' | 'push'>('email');
  const [key, setKey] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await notificationTemplatesApi.list(tenantSlug);
    if (res.success && res.data) setTemplates(res.data);
    else setError(res.error?.message ?? 'Could not load templates.');
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim() || !body.trim()) return;
    setSaving(true);
    setError(null);
    const res = await notificationTemplatesApi.create(tenantSlug, { channel, key: key.trim(), subject: subject.trim() || undefined, body: body.trim() });
    if (res.success) {
      setKey('');
      setSubject('');
      setBody('');
      load();
    } else {
      setError(res.error?.message ?? 'Could not create the template.');
    }
    setSaving(false);
  }

  async function handleToggleActive(t: NotificationTemplate) {
    const res = await notificationTemplatesApi.update(tenantSlug, t.id, { isActive: !t.isActive });
    if (res.success) load();
  }

  async function handleDelete(t: NotificationTemplate) {
    if (!confirm(`Delete template "${t.key}"?`)) return;
    const res = await notificationTemplatesApi.remove(tenantSlug, t.id);
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not delete the template.');
  }

  return (
    <div className="grid md:grid-cols-[1fr_1.3fr] gap-8">
      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-5 h-fit space-y-3">
        <h2 className="font-serif text-lg text-[#1E2A44] flex items-center gap-1.5">
          <Mail className="h-4 w-4" /> New template
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as 'email' | 'sms' | 'push')} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Key</label>
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="welcome_new_member" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20" required />
          </div>
        </div>
        {channel === 'email' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Welcome to {{churchName}}!" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20" />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi {{firstName}}, welcome to {{churchName}}."
            rows={4}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
            required
          />
          <p className="text-xs text-slate-400 mt-1">Use {'{{placeholder}}'} tokens — filled in when the notification is sent.</p>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <button type="submit" disabled={saving} className="rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: '#1E2A44' }}>
          {saving ? 'Creating…' : 'Create template'}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden h-fit">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">No templates yet.</div>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.key}</p>
                  <p className="text-xs text-slate-400">{t.channel}{t.subject ? ` · ${t.subject}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(t)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border ${t.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                  >
                    {t.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => handleDelete(t)} className="text-xs text-red-500 hover:underline">
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">{t.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NumberingSequencesTab({ tenantSlug }: { tenantSlug: string }) {
  const [sequences, setSequences] = useState<NumberingSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [key, setKey] = useState('');
  const [prefix, setPrefix] = useState('');
  const [padding, setPadding] = useState(4);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await numberingSequencesApi.list(tenantSlug);
    if (res.success && res.data) setSequences(res.data);
    else setError(res.error?.message ?? 'Could not load sequences.');
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setSaving(true);
    setError(null);
    const res = await numberingSequencesApi.create(tenantSlug, { key: key.trim(), prefix: prefix.trim() || undefined, padding });
    if (res.success) {
      setKey('');
      setPrefix('');
      setPadding(4);
      load();
    } else {
      setError(res.error?.message ?? 'Could not create the sequence.');
    }
    setSaving(false);
  }

  async function handleDelete(s: NumberingSequence) {
    if (!confirm(`Delete sequence "${s.key}"?`)) return;
    const res = await numberingSequencesApi.remove(tenantSlug, s.id);
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not delete the sequence.');
  }

  return (
    <div className="grid md:grid-cols-[1fr_1.3fr] gap-8">
      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-5 h-fit space-y-3">
        <h2 className="font-serif text-lg text-[#1E2A44] flex items-center gap-1.5">
          <Hash className="h-4 w-4" /> New sequence
        </h2>
        <p className="text-xs text-slate-400">
          Auto-fills membership/receipt numbers left blank on creation — use key{' '}
          <code className="text-[11px] bg-slate-100 px-1 rounded">member_membership_number</code> or{' '}
          <code className="text-[11px] bg-slate-100 px-1 rounded">contribution_receipt_number</code>.
        </p>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Key</label>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="member_membership_number" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Prefix</label>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="MEM-" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Padding</label>
            <input type="number" min={1} value={padding} onChange={(e) => setPadding(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20" />
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <button type="submit" disabled={saving} className="rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: '#1E2A44' }}>
          {saving ? 'Creating…' : 'Create sequence'}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden h-fit">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : sequences.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">No sequences yet.</div>
        ) : (
          sequences.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{s.key}</p>
                <p className="text-xs text-slate-400">
                  Next: {s.prefix}
                  {String(s.nextValue).padStart(s.padding, '0')}
                </p>
              </div>
              <button onClick={() => handleDelete(s)} className="text-xs text-red-500 hover:underline">
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Best-effort human-readable label for a trash row, since each resource's shape differs. */
function trashItemLabel(item: TrashItem): string {
  const candidates = ['name', 'label', 'title', 'fullName', 'key', 'fieldKey', 'email'];
  for (const field of candidates) {
    const value = item[field];
    if (typeof value === 'string' && value.trim()) return value;
  }
  if (typeof item.firstName === 'string' || typeof item.lastName === 'string') {
    return [item.firstName, item.lastName].filter(Boolean).join(' ') || `#${item.id.slice(0, 8)}`;
  }
  return `#${item.id.slice(0, 8)}`;
}

function TrashTab({ tenantSlug }: { tenantSlug: string }) {
  const [resources, setResources] = useState<TrashResource[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    setLoadingResources(true);
    trashApi.listResources(tenantSlug).then((res) => {
      if (res.success && res.data) {
        setResources(res.data);
        if (res.data.length > 0) setSelected(res.data[0].key);
      } else {
        setError(res.error?.message ?? 'Could not load trash resources.');
      }
      setLoadingResources(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  async function loadItems(resourceKey: string) {
    setLoadingItems(true);
    setError(null);
    const res = await trashApi.list(tenantSlug, resourceKey);
    if (res.success && res.data) setItems(res.data);
    else setError(res.error?.message ?? 'Could not load deleted items.');
    setLoadingItems(false);
  }

  useEffect(() => {
    if (selected) loadItems(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function handleRestore(item: TrashItem) {
    if (!selected) return;
    setRestoringId(item.id);
    const res = await trashApi.restore(tenantSlug, selected, item.id);
    if (res.success) loadItems(selected);
    else setError(res.error?.message ?? 'Could not restore this item.');
    setRestoringId(null);
  }

  return (
    <div>
      <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
        <Trash2 className="h-3.5 w-3.5" /> Nothing is permanently deleted by default — restore any of these to bring
        it back into active use.
      </p>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

      {loadingResources ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
      ) : resources.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">You don&apos;t have permission to view any trash resources.</div>
      ) : (
        <div className="grid md:grid-cols-[220px_1fr] gap-6">
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden h-fit">
            {resources.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelected(r.key)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  selected === r.key ? 'bg-[#1E2A44]/5 text-[#1E2A44] font-medium' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden h-fit">
            {loadingItems ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Nothing in the trash here.</div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{trashItemLabel(item)}</p>
                    <p className="text-xs text-slate-400">Deleted {new Date(item.deletedAt).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => handleRestore(item)}
                    disabled={restoringId === item.id}
                    className="text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-60"
                  >
                    {restoringId === item.id ? 'Restoring…' : 'Restore'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GuestAccessTab({ tenantSlug }: { tenantSlug: string }) {
  const [toggles, setToggles] = useState<FeatureToggle[]>([]);
  const [publicModules, setPublicModules] = useState<DynamicModuleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [togglesRes, modulesRes] = await Promise.all([
      featureTogglesApi.list(tenantSlug),
      dynamicModuleDefinitionsApi.list(tenantSlug, undefined, true),
    ]);
    if (togglesRes.success && togglesRes.data) setToggles(togglesRes.data);
    else setError(togglesRes.error?.message ?? 'Could not load feature toggles.');
    if (modulesRes.success && modulesRes.data) setPublicModules(modulesRes.data.filter((m) => m.allowPublicSubmission));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  function isEnabled(featureKey: string): boolean {
    return toggles.find((t) => t.featureKey === featureKey)?.isEnabled ?? false;
  }

  async function handleToggle(featureKey: string) {
    setSavingKey(featureKey);
    const res = await featureTogglesApi.set(tenantSlug, featureKey, !isEnabled(featureKey));
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not update this toggle.');
    setSavingKey(null);
  }

  return (
    <div>
      <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5" /> Control what unauthenticated visitors to your public site can see and
        submit. Each switch here is a tenant-wide kill switch — a module also needs its own &ldquo;Allow guest
        submissions&rdquo; setting (Dynamic Module Builder) before it accepts public entries.
      </p>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Visitor self-registration</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Lets a guest register themselves as a visitor from a public form (no login required).
              </p>
              {isEnabled(GUEST_ACCESS_VISITOR_REGISTRATION_KEY) && (
                <a href="/visitor-register" target="_blank" rel="noreferrer" className="text-xs text-[#1E2A44] underline mt-1 inline-block">
                  /visitor-register ↗
                </a>
              )}
            </div>
            <button
              onClick={() => handleToggle(GUEST_ACCESS_VISITOR_REGISTRATION_KEY)}
              disabled={savingKey === GUEST_ACCESS_VISITOR_REGISTRATION_KEY}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                isEnabled(GUEST_ACCESS_VISITOR_REGISTRATION_KEY)
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {isEnabled(GUEST_ACCESS_VISITOR_REGISTRATION_KEY) ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Guest module submissions</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Lets guests submit to any module with its own &ldquo;Allow guest submissions&rdquo; setting turned on
                (e.g. prayer requests, service requests).
              </p>
            </div>
            <button
              onClick={() => handleToggle(GUEST_ACCESS_MODULES_KEY)}
              disabled={savingKey === GUEST_ACCESS_MODULES_KEY}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                isEnabled(GUEST_ACCESS_MODULES_KEY) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {isEnabled(GUEST_ACCESS_MODULES_KEY) ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-800 mb-2">Modules currently open to guest submissions</p>
            {publicModules.length === 0 ? (
              <p className="text-xs text-slate-400">
                None yet — turn on &ldquo;Allow guest submissions&rdquo; for a module in the Dynamic Module Builder.
              </p>
            ) : (
              <ul className="text-xs text-slate-600 space-y-1">
                {publicModules.map((m) => (
                  <li key={m.id} className="flex items-center justify-between">
                    <span>{m.label}</span>
                    {isEnabled(GUEST_ACCESS_MODULES_KEY) ? (
                      <a href={`/guest/${m.key}`} target="_blank" rel="noreferrer" className="text-[11px] text-[#1E2A44] underline">
                        /guest/{m.key} ↗
                      </a>
                    ) : (
                      <code className="text-[11px] text-slate-400">/guest/{m.key} (toggle off)</code>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
