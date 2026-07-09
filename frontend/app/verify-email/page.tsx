'use client';

// app/verify-email/page.tsx
// Confirms an email address using the token from the link registration
// sends. The token alone resolves which tenant/user this is — verification
// is informational only (see AuthService.sendVerificationEmail); nothing
// in the app blocks on it, so this page's only job is to close the loop
// and send the person back to sign in.

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '../../lib/api';

function VerifyEmailStatus() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'checking' | 'done' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('This verification link is missing its token.');
      return;
    }
    authApi
      .verifyEmail(token)
      .then((res) => {
        if (res.success) {
          setStatus('done');
        } else {
          setStatus('error');
          setError(res.error?.message ?? 'Could not verify this email.');
        }
      })
      .catch(() => {
        setStatus('error');
        setError('Could not reach the server. Check the API is running.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (status === 'checking') {
    return <div className="text-center text-sm text-slate-400">Verifying…</div>;
  }

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      Email verified.{' '}
      <Link href="/login" className="underline">
        Sign in
      </Link>{' '}
      to continue.
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F6F2] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-11 w-11 rounded-full bg-[#1E2A44] flex items-center justify-center">
            <span className="text-[#C9A24B] text-lg font-serif">✝</span>
          </div>
          <h1 className="font-serif text-2xl text-[#1E2A44] tracking-tight">Verify your email</h1>
        </div>

        <Suspense fallback={<div className="text-center text-sm text-slate-400">Loading…</div>}>
          <VerifyEmailStatus />
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
