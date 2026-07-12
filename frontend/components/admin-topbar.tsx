'use client';

// components/admin-topbar.tsx
// A slim top bar for every /admin/* page — today just a notification bell,
// but the natural place for anything else that needs to be visible from
// every admin route. The bell is a live-derived view over the same
// GET /my-forms payload the My Forms page already renders (see
// myFormsApi.list) — "new request" means a MyFormAssignment with zero
// records against it yet; there is no separate read/unread state to track.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { myFormsApi, getCurrentTenant, MyFormAssignment } from '../lib/api';

function requestHref(item: MyFormAssignment): string {
  if (item.attachedToEntityType && item.attachedToEntityId) {
    const params = new URLSearchParams({
      attachedToEntityType: item.attachedToEntityType,
      attachedToEntityId: item.attachedToEntityId,
    });
    if (item.attachedToEntityLabel) params.set('label', item.attachedToEntityLabel);
    return `/admin/modules/${item.key}?${params.toString()}`;
  }
  return `/admin/modules/${item.key}`;
}

function requestLabel(item: MyFormAssignment): string {
  return item.attachedToEntityLabel ? `${item.label} — ${item.attachedToEntityLabel}` : item.label;
}

export function AdminTopbar() {
  const [pending, setPending] = useState<MyFormAssignment[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tenant = getCurrentTenant();
    if (!tenant) return;
    myFormsApi.list(tenant.slug).then((res) => {
      if (res.success && res.data) setPending(res.data.filter((item) => item.myRecords.length === 0));
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="h-14 border-b border-slate-200/70 bg-white flex items-center justify-end px-6">
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="relative h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-50"
          aria-label="Pending form requests"
        >
          <Bell className="h-4 w-4" strokeWidth={2} />
          {pending.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-[#C9A24B] text-white text-[10px] font-medium flex items-center justify-center">
              {pending.length > 9 ? '9+' : pending.length}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg z-30">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {pending.length === 0 ? 'No pending requests' : `${pending.length} pending request${pending.length === 1 ? '' : 's'}`}
              </p>
            </div>
            {pending.length > 0 && (
              <div className="divide-y divide-slate-50">
                {pending.map((item, i) => (
                  <Link
                    key={`${item.definitionId}-${item.attachedToEntityId ?? 'generic'}-${i}`}
                    href={requestHref(item)}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 hover:bg-slate-50"
                  >
                    <p className="text-sm text-slate-800">{requestLabel(item)}</p>
                    {item.dueAt && <p className="text-xs text-slate-400 mt-0.5">Due {new Date(item.dueAt).toLocaleDateString()}</p>}
                  </Link>
                ))}
              </div>
            )}
            <Link
              href="/admin/my-forms"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-xs font-medium text-[#1E2A44] text-center border-t border-slate-100 hover:bg-slate-50"
            >
              View all
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
