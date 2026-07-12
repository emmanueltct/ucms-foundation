'use client';

// app/admin/settings/modules/page.tsx
// §4's "Modules" Configuration Center page — a read-only catalog of every
// Dynamic Module this tenant has, each linking to its live data view.
// Creating/editing a module's definition itself still happens in Dynamic
// Modules (the builder) — this page is the directory, not the editor.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { dynamicModuleDefinitionsApi, getCurrentTenant, isAccessDeniedResponse, DynamicModuleDefinition } from '../../../../lib/api';
import { AccessDenied } from '../../../../components/access-denied';

export default function ModulesCatalogPage() {
  const tenant = getCurrentTenant();
  const [modules, setModules] = useState<DynamicModuleDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    dynamicModuleDefinitionsApi.list(tenant.slug, undefined, true).then((res) => {
      if (isAccessDeniedResponse(res)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      if (res.success && res.data) setModules(res.data);
      else setError(res.error?.message ?? 'Could not load modules.');
      setLoading(false);
    });
  }, [tenant?.slug]);

  if (accessDenied) return <AccessDenied />;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Center</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Modules</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Every Dynamic Module this church has — built-in or custom. Open one to see its live data, or head to{' '}
            <Link href="/admin/settings/dynamic-modules" className="underline text-[#1E2A44]">
              Dynamic Modules
            </Link>{' '}
            to create a new one.
          </p>
        </header>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : modules.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No modules yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {modules.map((m) => (
                <Link key={m.id} href={`/admin/modules/${m.key}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-[#1E2A44]">{m.label}</p>
                    {m.description && <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>}
                  </div>
                  <span className="text-xs text-slate-400">{m.key}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
