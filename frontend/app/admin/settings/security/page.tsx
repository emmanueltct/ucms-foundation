'use client';

// app/admin/settings/security/page.tsx
// Lets a user enroll in or disable Two-Factor Authentication (TOTP) for
// their own account. Enrollment is two steps by design: /mfa/setup issues
// a secret that isn't enforced until confirmed via /mfa/enable with a code
// from the authenticator app, so an abandoned setup never locks anyone out.

import { useEffect, useState } from 'react';
import {
  mfaApi,
  authApi,
  getCurrentTenant,
  getCurrentUser,
  updateCurrentUserMfaStatus,
  MfaSetupResult,
  AuthSession,
  LoginHistoryEntry,
} from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { ShieldCheck, ShieldOff, Monitor, History } from 'lucide-react';

const LOGIN_HISTORY_LABELS: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in attempt',
  'auth.logout': 'Signed out',
  'auth.switch_tenant': 'Switched workspace',
};

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  if (/Mobile|Android|iPhone/i.test(userAgent)) return 'Mobile browser';
  if (/Chrome/i.test(userAgent)) return 'Chrome';
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  if (/Safari/i.test(userAgent)) return 'Safari';
  if (/Edg/i.test(userAgent)) return 'Edge';
  return 'Browser';
}

export default function SecuritySettingsPage() {
  const tenant = getCurrentTenant();
  const [mfaEnabled, setMfaEnabled] = useState(() => getCurrentUser()?.mfaEnabled ?? false);
  const [setupData, setSetupData] = useState<MfaSetupResult | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  async function loadSessionsAndHistory() {
    if (!tenant) return;
    setSessionsLoading(true);
    try {
      const [sessionsRes, historyRes] = await Promise.all([
        authApi.listSessions(tenant.slug),
        authApi.loginHistory(tenant.slug),
      ]);
      if (sessionsRes.success && sessionsRes.data) setSessions(sessionsRes.data);
      if (historyRes.success && historyRes.data) setHistory(historyRes.data);
    } catch {
      // non-fatal — the MFA section above still works independently
    } finally {
      setSessionsLoading(false);
    }
  }

  useEffect(() => {
    loadSessionsAndHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRevokeSession(id: string) {
    if (!tenant) return;
    try {
      const res = await authApi.revokeSession(tenant.slug, id);
      if (res.success) setSessions((prev) => prev.filter((s) => s.id !== id));
      else setError(res.error?.message ?? 'Could not revoke that session.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleStartSetup() {
    if (!tenant) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await mfaApi.setup(tenant.slug);
      if (res.success && res.data) setSetupData(res.data);
      else setError(res.error?.message ?? 'Could not start MFA setup.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmEnable(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setError(null);
    setLoading(true);
    try {
      const res = await mfaApi.enable(tenant.slug, code);
      if (res.success) {
        updateCurrentUserMfaStatus(true);
        setMfaEnabled(true);
        setSetupData(null);
        setCode('');
        setSuccess('Two-factor authentication is now enabled.');
      } else {
        setError(res.error?.message ?? 'Invalid code.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setError(null);
    setLoading(true);
    try {
      const res = await mfaApi.disable(tenant.slug, code);
      if (res.success) {
        updateCurrentUserMfaStatus(false);
        setMfaEnabled(false);
        setCode('');
        setSuccess('Two-factor authentication has been disabled.');
      } else {
        setError(res.error?.message ?? 'Invalid code.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Settings</p>
        <h1 className="font-serif text-3xl text-[#1E2A44]">Security</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-xl">
          Add a second layer of protection to your account with an authenticator app (Google Authenticator,
          Authy, 1Password, ...).
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          {mfaEnabled ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600" strokeWidth={2} />
          ) : (
            <ShieldOff className="h-5 w-5 text-slate-400" strokeWidth={2} />
          )}
          <div>
            <p className="text-sm font-medium text-slate-800">Two-factor authentication</p>
            <p className="text-xs text-slate-400">{mfaEnabled ? 'Enabled' : 'Not enabled'}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 mb-4">
            {success}
          </div>
        )}

        {!mfaEnabled && !setupData && (
          <Button onClick={handleStartSetup} disabled={loading} style={{ backgroundColor: '#1E2A44' }}>
            {loading ? 'Starting…' : 'Enable 2FA'}
          </Button>
        )}

        {!mfaEnabled && setupData && (
          <form onSubmit={handleConfirmEnable} className="space-y-4">
            <p className="text-sm text-slate-600">
              Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setupData.qrCodeDataUrl} alt="MFA QR code" className="h-40 w-40 rounded-lg border border-slate-200" />
            <p className="text-xs text-slate-400 font-mono break-all">Manual entry key: {setupData.secret}</p>
            <div>
              <Label htmlFor="mfa-code" className="mb-1 text-slate-600">Code from your app</Label>
              <Input
                id="mfa-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="max-w-[160px]"
              />
            </div>
            <Button type="submit" disabled={loading} style={{ backgroundColor: '#1E2A44' }}>
              {loading ? 'Confirming…' : 'Confirm & enable'}
            </Button>
          </form>
        )}

        {mfaEnabled && (
          <form onSubmit={handleDisable} className="space-y-4">
            <div>
              <Label htmlFor="mfa-disable-code" className="mb-1 text-slate-600">
                Enter a current code to disable
              </Label>
              <Input
                id="mfa-disable-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="max-w-[160px]"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              {loading ? 'Disabling…' : 'Disable 2FA'}
            </Button>
          </form>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <Monitor className="h-5 w-5 text-slate-400" strokeWidth={2} />
          <div>
            <p className="text-sm font-medium text-slate-800">Active sessions</p>
            <p className="text-xs text-slate-400">Devices currently signed in to your account</p>
          </div>
        </div>
        {sessionsLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-400">No active sessions found.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-slate-800">{describeDevice(s.userAgent)}</p>
                  <p className="text-xs text-slate-400">
                    {s.ipAddress ?? 'Unknown IP'} · signed in {s.createdAt.slice(0, 10)}
                  </p>
                </div>
                <button
                  onClick={() => handleRevokeSession(s.id)}
                  className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                >
                  Sign out
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <History className="h-5 w-5 text-slate-400" strokeWidth={2} />
          <div>
            <p className="text-sm font-medium text-slate-800">Recent login activity</p>
            <p className="text-xs text-slate-400">The last {history.length > 0 ? history.length : ''} sign-in related events on your account</p>
          </div>
        </div>
        {sessionsLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="py-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium ${h.action === 'auth.login_failed' ? 'text-red-600' : 'text-slate-700'}`}
                  >
                    {LOGIN_HISTORY_LABELS[h.action] ?? h.action}
                  </span>
                  {h.metadata?.reason && (
                    <span className="text-[11px] text-slate-400">({h.metadata.reason.replace(/_/g, ' ')})</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {h.ipAddress ?? 'Unknown IP'} · {h.createdAt.slice(0, 19).replace('T', ' ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
