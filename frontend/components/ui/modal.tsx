'use client';

// components/ui/modal.tsx
// A small, generic popup-modal primitive — backdrop + centered card,
// closes on Escape or a backdrop click. Used for per-record detail/edit
// views (see app/admin/modules/[key]/page.tsx) instead of a permanent
// side panel, so the records table itself can use the full page width.

import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        {title && (
          <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
            <h2 className="font-serif text-lg text-[#1E2A44]">{title}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
