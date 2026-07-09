'use client';

// app/login/page.tsx
// Sign-in with just email + password — no workspace field required. The
// backend routes by email across every church workspace; this page only
// asks which one when the same email+password matches more than one
// (WorkspaceSelectionResult), and only asks for an authenticator code when
// the resolved account has MFA enabled (MFA_REQUIRED).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, setSession, WorkspaceOption } from '../../lib/api';
import { Button } from '@/components/ui/button';

type Step = 'credentials' | 'workspace' | 'mfa';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function attemptLogin(tenantSlug: string | undefined, code: string | undefined) {
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login(email, password, tenantSlug, code);

      if (!res.success || !res.data) {
        const errorCode = res.error?.code;
        if (errorCode === 'MFA_REQUIRED') {
          setSelectedSlug(tenantSlug);
          setStep('mfa');
          return;
        }
        setError(res.error?.message ?? 'Sign in failed.');
        return;
      }

      if ('requiresWorkspaceSelection' in res.data) {
        setWorkspaces(res.data.workspaces);
        setStep('workspace');
        return;
      }

      setSession(res.data.tokens.accessToken, res.data.tokens.refreshToken, res.data.tenant, res.data.user);
      router.push('/admin');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    attemptLogin(undefined, undefined);
  }

  function handleWorkspacePick(slug: string) {
    setSelectedSlug(slug);
    attemptLogin(slug, undefined);
  }

  function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    attemptLogin(selectedSlug, mfaCode);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F6F2] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-11 w-11 rounded-full bg-[#1E2A44] flex items-center justify-center">
            <span className="text-[#C9A24B] text-lg font-serif">✝</span>
          </div>
          <h1 className="font-serif text-2xl text-[#1E2A44] tracking-tight">
            {step === 'workspace' ? 'Which church?' : step === 'mfa' ? "Verify it’s you" : 'Sign in'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {step === 'workspace'
              ? 'This email is registered at more than one church — pick where you’re signing in.'
              : step === 'mfa'
                ? 'Enter the 6-digit code from your authenticator app.'
                : 'Just your email and password — we’ll find your church.'}
          </p>
        </div>

        {step === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@church.rw"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
                required
                autoFocus
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-600">Password</label>
                <Link href="/forgot-password" className="text-xs text-[#1E2A44] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-[#1E2A44] hover:bg-[#1E2A44]/90">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}

        {step === 'workspace' && (
          <div className="space-y-2">
            {workspaces.map((w) => (
              <button
                key={w.slug}
                onClick={() => handleWorkspacePick(w.slug)}
                disabled={loading}
                className="w-full flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 hover:border-[#1E2A44]/40 hover:bg-slate-50 transition-colors"
              >
                <span>{w.name}</span>
                <span className="text-xs text-slate-400">{w.slug}</span>
              </button>
            ))}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <button
              onClick={() => setStep('credentials')}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 pt-2"
            >
              ← Use a different email
            </button>
          </div>
        )}

        {step === 'mfa' && (
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Authenticator code</label>
              <input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 tracking-widest outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-[#1E2A44] hover:bg-[#1E2A44]/90">
              {loading ? 'Verifying…' : 'Verify'}
            </Button>
            <button
              type="button"
              onClick={() => setStep('credentials')}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600"
            >
              ← Back
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Demo credentials: admin@demo-church.test / ChangeMe123
        </p>
      </div>
    </div>
  );
}
