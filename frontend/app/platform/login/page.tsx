'use client';

// app/platform/login/page.tsx
// Platform Admin sign-in — deliberately separate from the tenant /login page
// (different token store, no tenant/workspace concept at all). This is the
// "admin of the company signs in first" entry point: from here a platform
// admin provisions a new church (tenant) and hands it off to one person.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { platformAuthApi, setPlatformSession } from '../../../lib/api';
import { Button } from '@/components/ui/button';

export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await platformAuthApi.login(email, password);
      if (!res.success || !res.data) {
        setError(res.error?.message ?? 'Sign in failed.');
        return;
      }
      setPlatformSession(res.data.accessToken, res.data.admin);
      router.push('/platform/tenants');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#11162A] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-11 w-11 rounded-full bg-[#C9A24B] flex items-center justify-center">
            <span className="text-[#11162A] text-lg font-serif">⬡</span>
          </div>
          <h1 className="font-serif text-2xl text-white tracking-tight">Platform Admin</h1>
          <p className="text-sm text-slate-400 mt-1">Provision and manage church workspaces.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="platform-admin@ucms.app"
              className="w-full rounded-lg border border-slate-700 bg-[#1A2038] px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#C9A24B]/30 focus:border-[#C9A24B]"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-700 bg-[#1A2038] px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#C9A24B]/30 focus:border-[#C9A24B]"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</div>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-[#C9A24B] hover:bg-[#C9A24B]/90 text-[#11162A]">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Looking to sign in to your church&apos;s workspace instead?{' '}
          <a href="/login" className="text-slate-300 hover:underline">
            Go there
          </a>
        </p>
      </div>
    </div>
  );
}
