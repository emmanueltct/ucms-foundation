'use client';

// app/reset-password/page.tsx
// Completes a password reset using the token from the emailed link. The
// token alone resolves which tenant/user this is — no workspace field needed.

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '../../lib/api';
import { Button } from '@/components/ui/button';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPassword(token, newPassword);
      if (!res.success) {
        setError(res.error?.message ?? 'Could not reset your password.');
        return;
      }
      setDone(true);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        This reset link is missing its token. Request a new one from the{' '}
        <Link href="/forgot-password" className="underline">
          forgot password
        </Link>{' '}
        page.
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Password updated.{' '}
        <Link href="/login" className="underline">
          Sign in
        </Link>{' '}
        with your new password.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">New password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
          required
          minLength={8}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Confirm new password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
          required
          minLength={8}
        />
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Button type="submit" disabled={loading} className="w-full bg-[#1E2A44] hover:bg-[#1E2A44]/90">
        {loading ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F6F2] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-11 w-11 rounded-full bg-[#1E2A44] flex items-center justify-center">
            <span className="text-[#C9A24B] text-lg font-serif">✝</span>
          </div>
          <h1 className="font-serif text-2xl text-[#1E2A44] tracking-tight">Choose a new password</h1>
          <p className="text-sm text-slate-500 mt-1">At least 8 characters, with a letter and a number.</p>
        </div>

        <Suspense fallback={<div className="text-center text-sm text-slate-400">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/login" className="text-[#1E2A44] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
