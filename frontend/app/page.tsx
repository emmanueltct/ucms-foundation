// app/page.tsx
// Public marketing/landing page — the platform's front door. Links out to
// the tenant-aware sign-in and the onboarding wizard; the rest of the app
// (admin/*) is reached after authenticating.

import Link from 'next/link';
import {
  Building2,
  Users,
  Wallet,
  CalendarCheck,
  HeartHandshake,
  Users2,
  CalendarDays,
  Bell,
  Briefcase,
  BarChart3,
  Boxes,
  UserPlus,
  FileText,
  SlidersHorizontal,
  ListPlus,
  ShieldCheck,
  Layers,
  Globe,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { ThemeToggle } from '../components/theme-toggle';

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

const HIGHLIGHTS: { icon: LucideIcon; stat: string; label: string }[] = [
  { icon: Layers, stat: '16', label: 'Modules live today' },
  { icon: SlidersHorizontal, stat: '15+', label: 'Tenant-configurable categories' },
  { icon: Lock, stat: '100%', label: 'Tenant-isolated data' },
];

const MODULES: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: Building2, title: 'Church & Hierarchy', description: 'One self-referencing branch tree — fits a single church or a full diocese, no schema change either way.' },
  { icon: Users, title: 'Member & Family', description: 'Profiles attached to a branch, grouped into households, with membership categories your team defines.' },
  { icon: Wallet, title: 'Finance', description: 'Tithes, offerings, and gifts recorded per branch and member. Mistakes are voided with a reason, never edited away.' },
  { icon: CalendarCheck, title: 'Attendance', description: 'Check in a named member or log a head-count for a large service — both roll into the same totals.' },
  { icon: HeartHandshake, title: 'Ministry & Volunteers', description: 'Serving teams with a roster and roles — ushering, choir, media — shaped entirely by your church.' },
  { icon: Users2, title: 'Small Groups & Children’s Ministry', description: 'Home groups, Bible studies, and age-graded Sunday School classes, each with its own schedule and capacity.' },
  { icon: CalendarDays, title: 'Events', description: 'One-off gatherings with registration by member or walk-in guest, and a soft capacity cap.' },
  { icon: Bell, title: 'Communication', description: 'Email, SMS, and push notifications dispatched through a durable, trackable queue.' },
  { icon: Briefcase, title: 'HR & Payroll', description: 'Staff records and payroll runs with a strict pending → paid lifecycle, mirroring Finance’s discipline.' },
  { icon: BarChart3, title: 'Reports & Analytics', description: 'Live trends across giving, attendance, membership, and payroll — computed on request, always current.' },
  { icon: Boxes, title: 'Asset & Facility', description: 'A register for buildings, vehicles, and equipment, with category-specific fields and document uploads.' },
  { icon: UserPlus, title: 'Visitor Follow-up', description: 'Track a first-time guest from initial contact through logged outreach to becoming a member.' },
  { icon: FileText, title: 'Document Management', description: 'Policies, minutes, forms, and certificates — one categorized, searchable store.' },
  { icon: SlidersHorizontal, title: 'Configuration Engine', description: 'Ministries, contribution types, branch types — data your church owns and edits, zero code changes.' },
  { icon: ListPlus, title: 'Custom Fields', description: 'Add entirely new fields to any form — not just new dropdown values — without touching source code.' },
  { icon: ShieldCheck, title: 'RBAC + PBAC Security', description: 'Fine-grained permission codes, not hard-coded role names, so roles shape around how your church works.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F7F6F2] dark:bg-slate-950">
      <header className="border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[#1E2A44] flex items-center justify-center">
              <span className="text-[#C9A24B] text-sm font-serif">✝</span>
            </div>
            <span className="font-serif text-lg text-[#1E2A44] dark:text-slate-100 tracking-tight">UCMS</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-600 dark:text-slate-300 hover:text-[#1E2A44] dark:hover:text-white transition-colors">
              Sign in
            </Link>
            <Link href="/register">
              <Button size="sm" style={{ backgroundColor: '#1E2A44' }}>
                Register
              </Button>
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-96 opacity-[0.06]"
            style={{
              background: 'radial-gradient(60% 60% at 50% 40%, #1E2A44 0%, transparent 70%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-10 h-72 w-72 rounded-full opacity-[0.08] blur-3xl"
            style={{ backgroundColor: '#C9A24B' }}
          />
          <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
            <p className="text-xs uppercase tracking-widest text-[#C9A24B] font-medium mb-4">
              Unified Church Management System
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-[#1E2A44] dark:text-slate-100 tracking-tight max-w-3xl mx-auto leading-tight">
              One platform, configured for every church
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-5 max-w-xl mx-auto text-[15px] leading-relaxed">
              A multi-tenant SaaS built for churches across Rwanda and East Africa — hierarchy,
              membership, finance, and attendance, each shaped by your church&rsquo;s own structure and
              workflows, never hard-coded into ours.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link href="/register">
                <Button style={{ backgroundColor: '#1E2A44' }}>Register</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline">Sign in to your church</Button>
              </Link>
            </div>

            <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {HIGHLIGHTS.map((h) => (
                <div key={h.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm px-5 py-4">
                  <div className="mx-auto mb-2 h-9 w-9 rounded-full bg-[#1E2A44]/5 dark:bg-white/5 flex items-center justify-center">
                    <h.icon className="h-4 w-4 text-[#1E2A44] dark:text-slate-300" strokeWidth={2} />
                  </div>
                  <p className="font-serif text-2xl text-[#1E2A44] dark:text-slate-100">{h.stat}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{h.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-6 pb-16">
          <p className="text-center text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-4 flex items-center justify-center gap-1.5">
            <Globe className="h-3.5 w-3.5" strokeWidth={2} />
            Built for every denomination
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {DENOMINATIONS.map((d) => (
              <span
                key={d}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
              >
                {d}
              </span>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="text-center mb-10">
            <h2 className="font-serif text-2xl text-[#1E2A44] dark:text-slate-100">What&rsquo;s live today</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Built module by module — each one production-ready before the next begins.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MODULES.map((m) => (
              <div
                key={m.title}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-[#1E2A44]/30 dark:hover:border-slate-600 hover:shadow-sm transition-all"
              >
                <div className="h-9 w-9 rounded-lg bg-[#1E2A44]/5 dark:bg-white/5 flex items-center justify-center mb-3">
                  <m.icon className="h-4 w-4 text-[#1E2A44] dark:text-slate-300" strokeWidth={2} />
                </div>
                <h3 className="font-serif text-[15px] text-[#1E2A44] dark:text-slate-100 mb-1">{m.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{m.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-slate-400 dark:text-slate-500">
          UCMS — a configurable, multi-tenant church management platform. No tenant&rsquo;s data,
          branding, or configuration is ever visible to another.
        </div>
      </footer>
    </div>
  );
}
