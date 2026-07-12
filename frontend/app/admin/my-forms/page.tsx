'use client';

// app/admin/my-forms/page.tsx
// §14 "Form Submission Workflow" dashboard: every form/report currently
// assigned to me (resolved through §13's eligibility engine — by my branch,
// department, leadership appointments, and user category), each with my own
// submission(s) against it, if any, and its deadline if one was set.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { myFormsApi, isAccessDeniedResponse, MyFormAssignment } from '../../../lib/api';
import { AccessDenied } from '../../../components/access-denied';

const TENANT_SLUG = 'demo-church'; // in production this comes from the resolved workspace/domain

export default function MyFormsPage() {
  const [assignments, setAssignments] = useState<MyFormAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await myFormsApi.list(TENANT_SLUG);
      if (isAccessDeniedResponse(res)) {
        setAccessDenied(true);
        return;
      }
      if (res.success && res.data) setAssignments(res.data);
      else setError(res.error?.message ?? 'Could not load your assigned forms.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  function dueBadge(dueAt: string | null) {
    if (!dueAt) return null;
    const due = new Date(dueAt);
    const overdue = due.getTime() < Date.now();
    return (
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
          overdue ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200'
        }`}
      >
        {overdue ? 'Overdue — was due ' : 'Due '}
        {due.toLocaleDateString()}
      </span>
    );
  }

  function statusBadge(status: string) {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full border text-slate-500 bg-slate-100 border-slate-200 capitalize">{status}</span>;
  }

  if (accessDenied) return <AccessDenied />;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Dashboard</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">My Forms</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Every form or report currently assigned to you — by branch, department, leadership role, or user
            category — with your own submissions and deadline, if one was set.
          </p>
        </header>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : assignments.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No forms are currently assigned to you.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {assignments.map((a) => (
                <div key={a.definitionId} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/admin/modules/${a.key}`} className="font-serif text-lg text-[#1E2A44] hover:underline">
                        {a.label}
                      </Link>
                      {a.description && <p className="text-sm text-slate-500 mt-0.5">{a.description}</p>}
                    </div>
                    {dueBadge(a.dueAt)}
                  </div>

                  {a.myRecords.length === 0 ? (
                    <p className="text-xs text-slate-400 mt-2">You haven&apos;t submitted this yet.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {a.myRecords.map((r) => (
                        <span key={r.id} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          {statusBadge(r.status)}
                          <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <Link
                    href={`/admin/modules/${a.key}`}
                    className="inline-block mt-3 text-xs font-medium text-[#1E2A44] hover:underline"
                  >
                    {a.myRecords.length === 0 ? 'Complete this form →' : 'View / submit another →'}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
