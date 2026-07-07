'use client';

// app/login/page.tsx
// Sign-in for a specific church tenant. The tenant slug is part of the
// URL/subdomain in production; here it's a visible field so the page is
// self-contained for any church during local development.

import { useState } from 'react';
import { authApi, setSession } from '../../lib/api';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const [tenantSlug, setTenantSlug] = useState('demo-church');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login(tenantSlug, email, password);
      if (!res.success || !res.data) {
        setError(res.error?.message ?? 'Sign in failed.');
        return;
      }
      setSession(res.data.tokens.accessToken, res.data.tokens.refreshToken);
      setSuccess(true);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F6F2] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-11 w-11 rounded-full bg-[#1E2A44] flex items-center justify-center">
            <span className="text-[#C9A24B] text-lg font-serif">✝</span>
          </div>
          <h1 className="font-serif text-2xl text-[#1E2A44] tracking-tight">Sign in to your church</h1>
          <p className="text-sm text-slate-500 mt-1">Enter your church&apos;s workspace and your account details.</p>
        </div>

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Signed in. A real deployment would redirect to the dashboard here.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Church workspace</label>
              <input
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="kigali-baptist"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@church.rw"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
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

        <p className="mt-6 text-center text-xs text-slate-400">
          Demo credentials: admin@demo-church.test / ChangeMe123 (workspace: demo-church)
        </p>
      </div>
    </div>
  );
}
