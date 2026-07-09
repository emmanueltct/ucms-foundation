'use client';

// app/forgot-password/page.tsx
// Requests a password reset link. Deliberately not tenant-scoped — a
// person may not remember which church workspace they registered under —
// so this is just an email address, and the backend checks every tenant.

import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '../../lib/api';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      // Always shows the same generic confirmation, whether or not the email matched anything.
      setSubmitted(true);
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
          <h1 className="font-serif text-2xl text-[#1E2A44] tracking-tight">Reset your password</h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter the email you sign in with — we&apos;ll send a reset link for every church workspace it&apos;s
            registered to.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            If an account exists for that email, a reset link is on its way. Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-[#1E2A44] hover:bg-[#1E2A44]/90">
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/login" className="text-[#1E2A44] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
