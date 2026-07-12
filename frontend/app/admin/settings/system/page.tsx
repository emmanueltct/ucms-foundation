'use client';

// app/admin/settings/system/page.tsx
// §4's "System Settings" Configuration Center page — the tenant-wide
// defaults (currency/language/timezone) that were previously only set once,
// at tenant creation time, and are now editable here too.

import { useEffect, useState } from 'react';
import { tenantApi, getCurrentTenant, TenantProfile } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';

export default function SystemSettingsPage() {
  const tenant = getCurrentTenant();
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [currency, setCurrency] = useState('');
  const [language, setLanguage] = useState('');
  const [timezone, setTimezone] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    tenantApi.getProfile(tenant.slug).then((res) => {
      if (res.success && res.data) {
        setProfile(res.data);
        setCurrency(res.data.currency);
        setLanguage(res.data.language);
        setTimezone(res.data.timezone);
      } else {
        setError(res.error?.message ?? 'Could not load system settings.');
      }
      setLoading(false);
    });
  }, [tenant?.slug]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await tenantApi.updateSystemSettings(tenant.slug, { currency, language, timezone });
    if (res.success && res.data) {
      setProfile(res.data);
      setSaved(true);
    } else {
      setError(res.error?.message ?? 'Could not save system settings.');
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Center</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">System Settings</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Tenant-wide defaults — the currency Finance uses, the display language, and the timezone dates/times are
            shown in across the app.
          </p>
        </header>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}
        {saved && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 mb-4">Saved.</div>}

        {loading || !profile ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <Label htmlFor="sys-currency" className="mb-1 text-slate-600">
                Currency code
              </Label>
              <Input id="sys-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="RWF" />
            </div>
            <div>
              <Label htmlFor="sys-language" className="mb-1 text-slate-600">
                Language code
              </Label>
              <Input id="sys-language" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="en" />
            </div>
            <div>
              <Label htmlFor="sys-timezone" className="mb-1 text-slate-600">
                Timezone
              </Label>
              <Input id="sys-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Africa/Kigali" />
            </div>
            <Button type="submit" disabled={saving} style={{ backgroundColor: '#1E2A44' }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
