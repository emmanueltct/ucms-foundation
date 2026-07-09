'use client';

// components/email-verification-banner.tsx
// A dismissible-per-session nudge shown across /admin/* when the signed-in
// user's email isn't verified yet. Verification is informational only
// (nothing in the app is gated on it — see AuthService.sendVerificationEmail)
// so this is a nudge, not a blocker.

import { useState } from 'react';
import { authApi, getCurrentTenant, getCurrentUser } from '../lib/api';
import { Mail } from 'lucide-react';

export function EmailVerificationBanner() {
  const user = getCurrentUser();
  const tenant = getCurrentTenant();
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerifiedAt || dismissed) return null;

  async function handleResend() {
    if (!tenant) return;
    const res = await authApi.resendVerification(tenant.slug);
    if (res.success) setSent(true);
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm text-amber-800">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 shrink-0" strokeWidth={2} />
        {sent ? 'Verification email sent — check your inbox.' : `Please verify ${user.email} — check your inbox for a link.`}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {!sent && (
          <button onClick={handleResend} className="font-medium hover:underline">
            Resend
          </button>
        )}
        <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-800">
          Dismiss
        </button>
      </div>
    </div>
  );
}
