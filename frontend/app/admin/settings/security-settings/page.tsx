'use client';

// app/admin/settings/security-settings/page.tsx
// Tenant-wide session/token security configuration for a Denomination Admin
// (Configuration Center > Security Settings) — distinct from the personal
// /admin/settings/security page (MFA, this user's own devices/login history),
// which every user sees regardless of role. Every field here is optional:
// left blank, the platform default keeps applying, so an existing church's
// sessions behave exactly as before until an admin opts in.

import { useEffect, useState } from 'react';
import { getCurrentTenant, securitySettingsApi, SecuritySettings } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Lock } from 'lucide-react';

type FormState = { [K in keyof SecuritySettings]: string };

const EMPTY_FORM: FormState = {
  accessTokenTtlMinutes: '',
  refreshTokenTtlDays: '',
  inactivityLogoutMinutes: '',
  maxConcurrentSessions: '',
};

const FIELDS: Array<{ key: keyof SecuritySettings; label: string; help: string; placeholder: string }> = [
  {
    key: 'accessTokenTtlMinutes',
    label: 'Login session expiration (minutes)',
    help: 'How long a signed-in session stays valid before needing to silently refresh. Platform default: 15.',
    placeholder: '15',
  },
  {
    key: 'refreshTokenTtlDays',
    label: 'Authentication token expiration (days)',
    help: "How many days a device stays signed in before it must log in again from scratch. Platform default: 7.",
    placeholder: '7',
  },
  {
    key: 'inactivityLogoutMinutes',
    label: 'Automatic logout after inactivity (minutes)',
    help: 'Sign a session out if it goes this long without any activity. Leave blank to disable.',
    placeholder: 'Disabled',
  },
  {
    key: 'maxConcurrentSessions',
    label: 'Maximum concurrent sessions',
    help: 'Cap how many devices can be signed in at once — the oldest is signed out to make room. Leave blank for unlimited.',
    placeholder: 'Unlimited',
  },
];

export default function SecuritySettingsAdminPage() {
  const tenant = getCurrentTenant();
  const tenantSlug = tenant?.slug ?? '';

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    (async () => {
      setLoading(true);
      const res = await securitySettingsApi.get(tenantSlug);
      if (res.success) {
        const s = res.data;
        setForm({
          accessTokenTtlMinutes: s?.accessTokenTtlMinutes?.toString() ?? '',
          refreshTokenTtlDays: s?.refreshTokenTtlDays?.toString() ?? '',
          inactivityLogoutMinutes: s?.inactivityLogoutMinutes?.toString() ?? '',
          maxConcurrentSessions: s?.maxConcurrentSessions?.toString() ?? '',
        });
      } else {
        setError(res.error?.message ?? 'Could not load security settings.');
      }
      setLoading(false);
    })();
  }, [tenantSlug]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const body: Partial<SecuritySettings> = {};
    for (const { key } of FIELDS) {
      const raw = form[key].trim();
      body[key] = raw === '' ? null : Number(raw);
    }

    const res = await securitySettingsApi.update(tenantSlug, body);
    if (res.success) setSuccess('Security settings saved.');
    else setError(res.error?.message ?? 'Could not save security settings.');
    setSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Center</p>
        <h1 className="font-serif text-3xl text-[#1E2A44] flex items-center gap-2">
          <Lock className="h-6 w-6" strokeWidth={2} /> Security Settings
        </h1>
        <p className="text-sm text-slate-500 mt-2 max-w-xl">
          Configure how long sessions and sign-ins last for everyone in this church. Leave a field blank to keep the
          platform default.
        </p>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 mb-4">{success}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <Label htmlFor={f.key} className="mb-1 text-slate-700">
                {f.label}
              </Label>
              <Input
                id={f.key}
                type="number"
                min={1}
                value={form[f.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="max-w-[200px]"
              />
              <p className="text-xs text-slate-400 mt-1">{f.help}</p>
            </div>
          ))}

          <Button type="submit" disabled={saving} style={{ backgroundColor: '#1E2A44' }}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </form>
      )}
    </div>
  );
}
