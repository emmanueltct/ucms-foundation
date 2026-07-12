'use client';

// components/admin-nav.tsx
// Persistent sidebar navigation for every /admin/* page — replaces what
// used to be a set of isolated, unlinked routes with one cohesive app shell.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  Wallet,
  CalendarCheck,
  HeartHandshake,
  Bell,
  SlidersHorizontal,
  CalendarDays,
  Briefcase,
  BarChart3,
  Boxes,
  UserPlus,
  FileText,
  Users2,
  HelpCircle,
  ChevronsUpDown,
  ShieldCheck,
  ClipboardList,
  ListChecks,
  Puzzle,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authApi, getCurrentTenant, setSession, WorkspaceOption, dynamicModuleDefinitionsApi, menuItemsApi, MenuItem } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/my-forms', label: 'My Forms', icon: ListChecks },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/branches', label: 'Branches', icon: Building2 },
  { href: '/admin/hierarchy-requirements', label: 'Level Requirements', icon: ClipboardList },
  { href: '/admin/members', label: 'Members', icon: Users },
  { href: '/admin/visitors', label: 'Visitors', icon: UserPlus },
  { href: '/admin/finance', label: 'Finance', icon: Wallet },
  { href: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/admin/ministries', label: 'Ministries', icon: HeartHandshake },
  { href: '/admin/small-groups', label: 'Small Groups', icon: Users2 },
  { href: '/admin/events', label: 'Events', icon: CalendarDays },
  { href: '/admin/hr', label: 'HR & Payroll', icon: Briefcase },
  { href: '/admin/assets', label: 'Assets', icon: Boxes },
  { href: '/admin/documents', label: 'Documents', icon: FileText },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/settings', label: 'Configuration Center', icon: Settings },
  { href: '/admin/help', label: 'Help & Test Guide', icon: HelpCircle },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [tenant, setTenant] = useState(getCurrentTenant());
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [dynamicNavItems, setDynamicNavItems] = useState<{ href: string; label: string }[]>([]);
  const [configuredMenuItems, setConfiguredMenuItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    const current = getCurrentTenant();
    setTenant(current);
    if (!current) return;
    authApi.listWorkspaces(current.slug).then((res) => {
      if (res.success && res.data) setWorkspaces(res.data);
    });
    dynamicModuleDefinitionsApi.list(current.slug, true).then((res) => {
      if (res.success && res.data) {
        setDynamicNavItems(res.data.map((m) => ({ href: `/admin/modules/${m.key}`, label: m.label })));
      }
    });
    // Additive: a tenant with zero configured menu items sees exactly the
    // static NAV_ITEMS list below, unchanged — this only adds to it.
    menuItemsApi.forCurrentUser(current.slug).then((res) => {
      if (res.success && res.data) setConfiguredMenuItems(res.data);
    });
  }, [pathname]);

  const topLevelConfigured = configuredMenuItems.filter((i) => !i.parentMenuItemId);
  const childrenOfConfigured = (id: string) => configuredMenuItems.filter((i) => i.parentMenuItemId === id);

  async function handleSwitch(targetSlug: string) {
    if (!tenant || targetSlug === tenant.slug) {
      setSwitcherOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await authApi.switchTenant(tenant.slug, targetSlug);
      if (res.success && res.data) {
        setSession(res.data.tokens.accessToken, res.data.tokens.refreshToken, res.data.tenant, res.data.user);
        setSwitcherOpen(false);
        router.push('/admin');
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200/70 bg-white min-h-screen sticky top-0 flex flex-col">
      <div className="border-b border-slate-200/70 relative">
        <button
          onClick={() => workspaces.length > 1 && setSwitcherOpen((v) => !v)}
          className={cn(
            'h-16 w-full flex items-center gap-2.5 px-5 text-left',
            workspaces.length > 1 && 'hover:bg-slate-50 cursor-pointer',
          )}
        >
          <div className="h-8 w-8 rounded-full bg-[#1E2A44] flex items-center justify-center shrink-0">
            <span className="text-[#C9A24B] text-sm font-serif">✝</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-sm text-[#1E2A44] leading-tight truncate">{tenant?.name ?? 'UCMS'}</p>
            <p className="text-[11px] text-slate-400 leading-tight">UCMS Admin</p>
          </div>
          {workspaces.length > 1 && <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300 shrink-0" />}
        </button>

        {switcherOpen && (
          <div className="absolute left-3 right-3 top-[calc(100%+4px)] z-10 rounded-lg border border-slate-200 bg-white shadow-md overflow-hidden">
            {workspaces.map((w) => (
              <button
                key={w.slug}
                onClick={() => handleSwitch(w.slug)}
                disabled={switching}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm transition-colors',
                  w.slug === tenant?.slug ? 'bg-[#1E2A44]/5 text-[#1E2A44] font-medium' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {w.name}
              </button>
            ))}
          </div>
        )}
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
        {dynamicNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
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
              <Puzzle className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.25 : 2} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        {topLevelConfigured.map((item) => (
          <div key={item.id}>
            <ConfiguredMenuLink item={item} pathname={pathname} />
            {childrenOfConfigured(item.id).map((child) => (
              <div key={child.id} className="pl-4">
                <ConfiguredMenuLink item={child} pathname={pathname} />
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-slate-200/70 space-y-2">
        {/* Personal MFA/devices/login-history — every user's own, not a Configuration Center (admin-only) surface, so it lives here instead of in NAV_ITEMS/SECTIONS. */}
        <Link
          href="/admin/settings/security"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ShieldCheck className="h-3.5 w-3.5" /> My account security
        </Link>
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
          ← Back to site
        </Link>
      </div>
    </aside>
  );
}

/** Renders one admin-configured MenuItem — target path is used verbatim as the href (see Menu Builder). */
function ConfiguredMenuLink({ item, pathname }: { item: MenuItem; pathname: string }) {
  const isActive = pathname.startsWith(item.targetKey);
  return (
    <Link
      href={item.targetKey}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive ? 'bg-[#1E2A44] text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-[#1E2A44]',
      )}
    >
      <SlidersHorizontal className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.25 : 2} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
