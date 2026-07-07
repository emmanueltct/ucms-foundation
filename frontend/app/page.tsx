// app/page.tsx
// Public marketing/landing page — the platform's front door. Links out to
// the tenant-aware sign-in and the onboarding wizard; the rest of the app
// (admin/*) is reached after authenticating.

import Link from 'next/link';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

const DENOMINATIONS = [
  'Catholic',
  'Anglican',
  'Pentecostal',
  'Baptist',
  'Presbyterian',
  'Adventist',
  'Evangelical',
  'Independent Ministries',
  'Non-denominational',
  'Faith-Based Organizations',
];

const MODULES = [
  {
    title: 'Church & Hierarchy',
    description:
      'A self-referencing branch tree that fits a single-location church or a full diocese → parish → district structure, without a schema change either way.',
  },
  {
    title: 'Member & Family',
    description:
      'Member profiles attached to a branch, grouped into households, with membership categories your team defines — not ones we hard-coded.',
  },
  {
    title: 'Finance',
    description:
      'Record tithes, offerings, and gifts against a branch and member. Mistakes are corrected by voiding with a reason — records are never silently edited.',
  },
  {
    title: 'Attendance',
    description:
      'Check in a named member or log a head-count for a large service — both roll up into the same per-service totals.',
  },
  {
    title: 'Configuration Engine',
    description:
      'Ministries, contribution types, ceremony names, branch types — all data your church owns and edits, with zero code changes.',
  },
  {
    title: 'RBAC + PBAC Security',
    description:
      'Fine-grained permission codes, not hard-coded role names, so every tenant can shape roles around how their church actually works.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <header className="border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[#1E2A44] flex items-center justify-center">
              <span className="text-[#C9A24B] text-sm font-serif">✝</span>
            </div>
            <span className="font-serif text-lg text-[#1E2A44] tracking-tight">UCMS</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-600 hover:text-[#1E2A44] transition-colors">
              Sign in
            </Link>
            <Link href="/onboarding">
              <Button size="sm" style={{ backgroundColor: '#1E2A44' }}>
                Start onboarding
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
          <p className="text-xs uppercase tracking-widest text-[#C9A24B] font-medium mb-4">
            Unified Church Management System
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-[#1E2A44] tracking-tight max-w-3xl mx-auto leading-tight">
            One platform, configured for every church
          </h1>
          <p className="text-slate-500 mt-5 max-w-xl mx-auto text-[15px] leading-relaxed">
            A multi-tenant SaaS built for churches across Rwanda and East Africa — hierarchy,
            membership, finance, and attendance, each shaped by your church&rsquo;s own structure and
            workflows, never hard-coded into ours.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/onboarding">
              <Button style={{ backgroundColor: '#1E2A44' }}>Start onboarding</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline">Sign in to your church</Button>
            </Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-6 pb-16">
          <p className="text-center text-xs uppercase tracking-wide text-slate-400 mb-4">
            Built for every denomination
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {DENOMINATIONS.map((d) => (
              <span
                key={d}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600"
              >
                {d}
              </span>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="text-center mb-10">
            <h2 className="font-serif text-2xl text-[#1E2A44]">What&rsquo;s live today</h2>
            <p className="text-sm text-slate-500 mt-2">
              Built module by module — each one production-ready before the next begins.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((m) => (
              <Card key={m.title} className="border-slate-200">
                <CardHeader>
                  <CardTitle className="font-serif text-base text-[#1E2A44]">{m.title}</CardTitle>
                  <CardDescription className="text-slate-500 leading-relaxed">{m.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-slate-400">
          UCMS — a configurable, multi-tenant church management platform. No tenant&rsquo;s data,
          branding, or configuration is ever visible to another.
        </div>
      </footer>
    </div>
  );
}
