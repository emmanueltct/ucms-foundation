// components/access-denied.tsx
// The entire page content when the caller's role lacks access to it — never
// rendered alongside a partial/broken layout, nav-adjacent data, or controls
// the user can't actually use. A page checks this before rendering anything
// else once its data fetch comes back 401/403 (see `isAccessDeniedResponse`
// in lib/api.ts).

import { ShieldOff } from 'lucide-react';

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center">
      <div className="text-center px-6">
        <ShieldOff className="h-8 w-8 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-serif text-xl text-[#1E2A44] mb-1">No access</p>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          {message ?? "You don't have permission to view this page. Ask a church administrator if you believe this is a mistake."}
        </p>
      </div>
    </div>
  );
}
