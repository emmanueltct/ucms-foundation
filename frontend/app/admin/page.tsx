'use client';

// app/admin/page.tsx
// Dashboard landing page — quick at-a-glance counts plus a jump-off point
// into every module, so signing in lands somewhere useful instead of a
// blank route.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Wallet,
  CalendarCheck,
  HeartHandshake,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import { branchesApi, membersApi, contributionsApi, attendanceApi, ministriesApi, notificationsApi } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';

const TENANT_SLUG = 'demo-church';

interface StatTile {
  label: string;
  href: string;
  icon: LucideIcon;
  value: number | null;
}

const MODULES = [
  { title: 'Branches', href: '/admin/branches', icon: Building2, description: 'Manage the organizational hierarchy.' },
  { title: 'Members', href: '/admin/members', icon: Users, description: 'Member profiles, families, custom fields.' },
  { title: 'Finance', href: '/admin/finance', icon: Wallet, description: 'Record and review contributions.' },
  { title: 'Attendance', href: '/admin/attendance', icon: CalendarCheck, description: 'Check-ins and head-counts.' },
  { title: 'Ministries', href: '/admin/ministries', icon: HeartHandshake, description: 'Ministries and volunteer rosters.' },
  { title: 'Notifications', href: '/admin/notifications', icon: Bell, description: 'Send and review messages.' },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<StatTile[]>([
    { label: 'Branches', href: '/admin/branches', icon: Building2, value: null },
    { label: 'Members', href: '/admin/members', icon: Users, value: null },
    { label: 'Contributions', href: '/admin/finance', icon: Wallet, value: null },
    { label: 'Attendance records', href: '/admin/attendance', icon: CalendarCheck, value: null },
    { label: 'Ministries', href: '/admin/ministries', icon: HeartHandshake, value: null },
    { label: 'Notifications sent', href: '/admin/notifications', icon: Bell, value: null },
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [branches, members, contributions, attendance, ministries, notifications] = await Promise.all([
          branchesApi.list(TENANT_SLUG),
          membersApi.list(TENANT_SLUG, {}),
          contributionsApi.list(TENANT_SLUG),
          attendanceApi.list(TENANT_SLUG),
          ministriesApi.list(TENANT_SLUG),
          notificationsApi.list(TENANT_SLUG),
        ]);
        setStats([
          { label: 'Branches', href: '/admin/branches', icon: Building2, value: branches.data?.length ?? 0 },
          { label: 'Members', href: '/admin/members', icon: Users, value: members.data?.length ?? 0 },
          { label: 'Contributions', href: '/admin/finance', icon: Wallet, value: contributions.data?.length ?? 0 },
          { label: 'Attendance records', href: '/admin/attendance', icon: CalendarCheck, value: attendance.data?.length ?? 0 },
          { label: 'Ministries', href: '/admin/ministries', icon: HeartHandshake, value: ministries.data?.length ?? 0 },
          { label: 'Notifications sent', href: '/admin/notifications', icon: Bell, value: notifications.data?.length ?? 0 },
        ]);
      } catch {
        setError('Could not reach the server — sign in first, or check the API is running.');
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Dashboard</p>
        <h1 className="font-serif text-3xl text-[#1E2A44]">Welcome back</h1>
        <p className="text-sm text-slate-500 mt-2">A quick look at what&rsquo;s happening across your church.</p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-6">{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-slate-200 bg-white p-4 hover:border-[#1E2A44]/30 hover:shadow-sm transition-all"
          >
            <s.icon className="h-4 w-4 text-[#C9A24B] mb-2" strokeWidth={2} />
            <p className="font-serif text-2xl text-[#1E2A44]">{s.value ?? '—'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      <h2 className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-3">Jump into a module</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="border-slate-200 hover:border-[#1E2A44]/30 hover:shadow-sm transition-all h-full">
              <CardHeader>
                <m.icon className="h-5 w-5 text-[#1E2A44] mb-1" strokeWidth={2} />
                <CardTitle className="font-serif text-base text-[#1E2A44]">{m.title}</CardTitle>
                <CardDescription className="text-slate-500">{m.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
