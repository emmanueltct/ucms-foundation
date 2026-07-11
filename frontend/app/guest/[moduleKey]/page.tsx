'use client';

// app/guest/[moduleKey]/page.tsx
// Public, unauthenticated guest form submission for a module with
// allowPublicSubmission enabled (e.g. prayer requests, service requests) —
// covers modules with no dedicated model of their own, distinct from
// Visitor self-registration (app/visitor-register/page.tsx) which routes
// through the first-class Visitor pipeline instead. Gated server-side by
// the module's own "Allow guest submissions" flag AND the tenant-wide
// guest_access.dynamic_modules feature toggle (see Configuration Center >
// Guest Access) — a 403 here means one of those two switches is off.
//
// Deliberately a plain title + message form, not a full custom-field
// renderer — a public custom-field-definitions API and dynamic form
// builder for anonymous users is out of scope here; an admin who needs
// more structured guest intake should use the dedicated Visitor
// registration flow or extend this form directly.

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { publicSubmissionApi } from '../../../lib/api';

const TENANT_SLUG = 'demo-church'; // in production this comes from the resolved workspace/domain

export default function GuestModuleSubmissionPage() {
  const params = useParams<{ moduleKey: string }>();
  const moduleKey = params.moduleKey;

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await publicSubmissionApi.submit(TENANT_SLUG, moduleKey, {
        title: title.trim(),
        customFields: message.trim() ? { message: message.trim() } : undefined,
      });
      if (res.success) {
        setSubmitted(true);
      } else {
        setError(res.error?.message ?? 'Could not submit this form.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F6F2] px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 h-11 w-11 rounded-full bg-[#1E2A44] flex items-center justify-center">
            <span className="text-[#C9A24B] text-lg font-serif">✝</span>
          </div>
          <h1 className="font-serif text-2xl text-[#1E2A44] tracking-tight">Thank you</h1>
          <p className="text-sm text-slate-500 mt-2">Your submission has been received.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F6F2] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-11 w-11 rounded-full bg-[#1E2A44] flex items-center justify-center">
            <span className="text-[#C9A24B] text-lg font-serif">✝</span>
          </div>
          <h1 className="font-serif text-2xl text-[#1E2A44] tracking-tight">Submit a request</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="A short summary"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#1E2A44] text-white text-sm font-medium py-2.5 hover:bg-[#1E2A44]/90 disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
