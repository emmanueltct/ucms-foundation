'use client';

// app/admin/settings/lookup-tables/page.tsx
// §4's "Lookup Tables" Configuration Center item. This codebase has one
// tenant-defined key/value mechanism — `ConfigItem`, namespaced (branch
// types, contribution types, ministry categories, user categories, ...) —
// already exposed as "Dropdown Values". "Lookup Tables" names the same
// mechanism from a different angle (a named list of allowed values), so
// this is a thin landing page over it rather than a second table-of-values
// system. See docs/dynamic-modules/business-analysis.md for the full §5
// write-up this design decision is part of.

import Link from 'next/link';
import { ListTree } from 'lucide-react';

export default function LookupTablesPage() {
  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Center</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Lookup Tables</h1>
        </header>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <ListTree className="h-6 w-6 text-[#C9A24B] mb-3" />
          <p className="text-sm text-slate-600 mb-4">
            Every tenant-defined list of allowed values — branch types, contribution types, ministry categories, and
            any other named list a form or module needs — lives in one place: Dropdown Values. There&apos;s no
            separate lookup-table mechanism to maintain.
          </p>
          <Link href="/admin/config" className="inline-block text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: '#1E2A44' }}>
            Open Dropdown Values →
          </Link>
        </div>
      </div>
    </div>
  );
}
