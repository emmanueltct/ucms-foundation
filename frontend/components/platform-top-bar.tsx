'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearPlatformSession, getCurrentPlatformAdmin, PlatformAdmin } from '../lib/api';

export function PlatformTopBar() {
  const router = useRouter();
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);

  useEffect(() => {
    setAdmin(getCurrentPlatformAdmin());
  }, []);

  function handleSignOut() {
    clearPlatformSession();
    router.push('/platform/login');
  }

  return (
    <header className="bg-[#11162A] text-white">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-full bg-[#C9A24B] flex items-center justify-center text-[#11162A] text-sm font-serif">⬡</span>
          <span className="font-serif text-lg tracking-tight">Platform Admin</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-300">
          {admin && <span>{admin.firstName} {admin.lastName}</span>}
          <button onClick={handleSignOut} className="text-slate-400 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
