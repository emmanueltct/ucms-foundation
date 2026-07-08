'use client';

// components/admin-nav.tsx
// Persistent sidebar navigation for every /admin/* page — replaces what
// used to be a set of isolated, unlinked routes with one cohesive app shell.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  Wallet,
  CalendarCheck,
  HeartHandshake,
  Bell,
  SlidersHorizontal,
  ListPlus,
  CalendarDays,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/branches', label: 'Branches', icon: Building2 },
  { href: '/admin/members', label: 'Members', icon: Users },
  { href: '/admin/finance', label: 'Finance', icon: Wallet },
  { href: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/admin/ministries', label: 'Ministries', icon: HeartHandshake },
  { href: '/admin/events', label: 'Events', icon: CalendarDays },
  { href: '/admin/hr', label: 'HR & Payroll', icon: Briefcase },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/config', label: 'Configuration', icon: SlidersHorizontal },
  { href: '/admin/settings/custom-fields', label: 'Custom Fields', icon: ListPlus },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200/70 bg-white min-h-screen sticky top-0 flex flex-col">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-200/70">
        <div className="h-8 w-8 rounded-full bg-[#1E2A44] flex items-center justify-center shrink-0">
          <span className="text-[#C9A24B] text-sm font-serif">✝</span>
        </div>
        <div className="min-w-0">
          <p className="font-serif text-sm text-[#1E2A44] leading-tight truncate">Demo Church</p>
          <p className="text-[11px] text-slate-400 leading-tight">UCMS Admin</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[#1E2A44] text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-[#1E2A44]',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.25 : 2} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-200/70">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
          ← Back to site
        </Link>
      </div>
    </aside>
  );
}
