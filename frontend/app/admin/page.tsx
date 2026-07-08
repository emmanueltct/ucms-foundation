'use client';

// app/admin/page.tsx
// Dashboard landing page — quick at-a-glance counts, live trend charts, and
// a jump-off point into every module, so signing in lands somewhere useful
// instead of a blank route.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
  Building2,
  Users,
  Wallet,
  CalendarCheck,
  HeartHandshake,
  Bell,
  CalendarDays,
  Briefcase,
  BarChart3,
  Boxes,
  UserPlus,
  FileText,
  Users2,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  branchesApi,
  membersApi,
  contributionsApi,
  attendanceApi,
  ministriesApi,
  notificationsApi,
  eventsApi,
  staffApi,
  assetsApi,
  visitorsApi,
  documentsApi,
  smallGroupsApi,
  reportsApi,
  MonthBucket,
} from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';

const TENANT_SLUG = 'demo-church';
const NAVY = '#1E2A44';
const GOLD = '#C9A24B';

interface StatTile {
  label: string;
  href: string;
  icon: LucideIcon;
  value: number | null;
}

const MODULES = [
  { title: 'Reports & Analytics', href: '/admin/reports', icon: BarChart3, description: 'Trends across giving, attendance, membership, and payroll.' },
  { title: 'Branches', href: '/admin/branches', icon: Building2, description: 'Manage the organizational hierarchy.' },
  { title: 'Members', href: '/admin/members', icon: Users, description: 'Member profiles, families, custom fields.' },
  { title: 'Visitors', href: '/admin/visitors', icon: UserPlus, description: 'Track first-time visitors through follow-up to joining.' },
  { title: 'Finance', href: '/admin/finance', icon: Wallet, description: 'Record and review contributions.' },
  { title: 'Attendance', href: '/admin/attendance', icon: CalendarCheck, description: 'Check-ins and head-counts.' },
  { title: 'Ministries', href: '/admin/ministries', icon: HeartHandshake, description: 'Ministries and volunteer rosters.' },
  { title: 'Small Groups', href: '/admin/small-groups', icon: Users2, description: 'Home groups, Bible studies, and Sunday School classes.' },
  { title: 'Events', href: '/admin/events', icon: CalendarDays, description: 'Schedule events and manage registrations.' },
  { title: 'HR & Payroll', href: '/admin/hr', icon: Briefcase, description: 'Staff records and payroll payments.' },
  { title: 'Assets', href: '/admin/assets', icon: Boxes, description: 'Buildings, vehicles, equipment — one register per category.' },
  { title: 'Documents', href: '/admin/documents', icon: FileText, description: 'Policies, minutes, forms, and other files, categorized.' },
  { title: 'Notifications', href: '/admin/notifications', icon: Bell, description: 'Send and review messages.' },
  { title: 'Help & Test Guide', href: '/admin/help', icon: HelpCircle, description: 'Feature coverage and step-by-step test scripts.' },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<StatTile[]>([
    { label: 'Branches', href: '/admin/branches', icon: Building2, value: null },
    { label: 'Members', href: '/admin/members', icon: Users, value: null },
    { label: 'Contributions', href: '/admin/finance', icon: Wallet, value: null },
    { label: 'Attendance records', href: '/admin/attendance', icon: CalendarCheck, value: null },
    { label: 'Ministries', href: '/admin/ministries', icon: HeartHandshake, value: null },
    { label: 'Small Groups', href: '/admin/small-groups', icon: Users2, value: null },
    { label: 'Events', href: '/admin/events', icon: CalendarDays, value: null },
    { label: 'Staff', href: '/admin/hr', icon: Briefcase, value: null },
    { label: 'Assets', href: '/admin/assets', icon: Boxes, value: null },
    { label: 'Visitors', href: '/admin/visitors', icon: UserPlus, value: null },
    { label: 'Documents', href: '/admin/documents', icon: FileText, value: null },
    { label: 'Notifications sent', href: '/admin/notifications', icon: Bell, value: null },
  ]);
  const [givingTrend, setGivingTrend] = useState<MonthBucket[]>([]);
  const [attendanceTrend, setAttendanceTrend] = useState<MonthBucket[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [branches, members, contributions, attendance, ministries, smallGroups, events, staff, assets, visitors, documents, notifications] = await Promise.all([
          branchesApi.list(TENANT_SLUG),
          membersApi.list(TENANT_SLUG, {}),
          contributionsApi.list(TENANT_SLUG),
          attendanceApi.list(TENANT_SLUG),
          ministriesApi.list(TENANT_SLUG),
          smallGroupsApi.list(TENANT_SLUG),
          eventsApi.list(TENANT_SLUG),
          staffApi.list(TENANT_SLUG),
          assetsApi.list(TENANT_SLUG),
          visitorsApi.list(TENANT_SLUG),
          documentsApi.list(TENANT_SLUG),
          notificationsApi.list(TENANT_SLUG),
        ]);
        setStats([
          { label: 'Branches', href: '/admin/branches', icon: Building2, value: branches.data?.length ?? 0 },
          { label: 'Members', href: '/admin/members', icon: Users, value: members.data?.length ?? 0 },
          { label: 'Contributions', href: '/admin/finance', icon: Wallet, value: contributions.data?.length ?? 0 },
          { label: 'Attendance records', href: '/admin/attendance', icon: CalendarCheck, value: attendance.data?.length ?? 0 },
          { label: 'Ministries', href: '/admin/ministries', icon: HeartHandshake, value: ministries.data?.length ?? 0 },
          { label: 'Small Groups', href: '/admin/small-groups', icon: Users2, value: smallGroups.data?.length ?? 0 },
          { label: 'Events', href: '/admin/events', icon: CalendarDays, value: events.data?.length ?? 0 },
          { label: 'Staff', href: '/admin/hr', icon: Briefcase, value: staff.data?.length ?? 0 },
          { label: 'Assets', href: '/admin/assets', icon: Boxes, value: assets.data?.length ?? 0 },
          { label: 'Visitors', href: '/admin/visitors', icon: UserPlus, value: visitors.data?.length ?? 0 },
          { label: 'Documents', href: '/admin/documents', icon: FileText, value: documents.data?.length ?? 0 },
          { label: 'Notifications sent', href: '/admin/notifications', icon: Bell, value: notifications.data?.length ?? 0 },
        ]);
      } catch {
        setError('Could not reach the server — sign in first, or check the API is running.');
      }
    }
    async function loadTrends() {
      try {
        const [finance, attendance] = await Promise.all([
          reportsApi.financeSummary(TENANT_SLUG),
          reportsApi.attendanceTrends(TENANT_SLUG),
        ]);
        if (finance.success && finance.data) setGivingTrend(finance.data.byMonth.slice(-6));
        if (attendance.success && attendance.data) setAttendanceTrend(attendance.data.byMonth.slice(-6));
      } catch {
        // Charts are a nice-to-have on this page — Reports has the full picture if this fails.
      }
    }
    load();
    loadTrends();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Dashboard</p>
        <h1 className="font-serif text-3xl text-[#1E2A44]">{greeting()}</h1>
        <p className="text-sm text-slate-500 mt-2">A quick look at what&rsquo;s happening across your church.</p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-6">{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-slate-200 bg-white p-4 hover:border-[#1E2A44]/30 hover:shadow-sm transition-all"
          >
            <div className="h-8 w-8 rounded-full bg-[#C9A24B]/10 flex items-center justify-center mb-2.5">
              <s.icon className="h-4 w-4 text-[#C9A24B]" strokeWidth={2} />
            </div>
            <p className="font-serif text-2xl text-[#1E2A44]">{s.value ?? '—'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase tracking-wide text-slate-400 font-medium">Giving, last 6 months</h3>
            <Link href="/admin/reports" className="text-xs text-[#1E2A44] hover:underline">
              Full report →
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={givingTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={36} />
              <Tooltip />
              <Bar dataKey="total" fill={GOLD} radius={[4, 4, 0, 0]} name="Total given" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase tracking-wide text-slate-400 font-medium">Attendance, last 6 months</h3>
            <Link href="/admin/reports" className="text-xs text-[#1E2A44] hover:underline">
              Full report →
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={36} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke={NAVY} strokeWidth={2} dot={false} name="Headcount" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2 className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-3">Jump into a module</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="border-slate-200 hover:border-[#1E2A44]/30 hover:shadow-sm transition-all h-full">
              <CardHeader>
                <div className="h-9 w-9 rounded-lg bg-[#1E2A44]/5 flex items-center justify-center mb-2">
                  <m.icon className="h-4 w-4 text-[#1E2A44]" strokeWidth={2} />
                </div>
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
