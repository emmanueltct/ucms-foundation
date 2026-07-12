'use client';

// app/admin/settings/entity-builder/page.tsx
// §4's "Entity Builder" Configuration Center item. There's no separate
// entity-modeling mechanism in this codebase — a custom "entity" IS a
// Dynamic Module (a definition plus its records), so this is a thin,
// explanatory landing page over the same Dynamic Modules builder, not a
// second no-code mechanism. See docs/dynamic-modules/business-analysis.md
// for the full §5 write-up this design decision is part of.

import Link from 'next/link';
import { Puzzle } from 'lucide-react';

export default function EntityBuilderPage() {
  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Center</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Entity Builder</h1>
        </header>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <Puzzle className="h-6 w-6 text-[#C9A24B] mb-3" />
          <p className="text-sm text-slate-600 mb-4">
            A custom entity — a new kind of record this church wants to track (Prayer Requests, Asset Inspections,
            Ministry Reports, or anything else) — is built the same way as any other Dynamic Module: define its
            fields, statuses, and where it can attach, and the system handles storage, permissions, and its own admin
            UI automatically. There&apos;s no separate &quot;entity&quot; mechanism to learn.
          </p>
          <Link
            href="/admin/settings/dynamic-modules"
            className="inline-block text-sm font-medium px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: '#1E2A44' }}
          >
            Open Dynamic Modules →
          </Link>
        </div>
      </div>
    </div>
  );
}
