'use client';

// app/admin/help/page.tsx
// Knowledge Base — a feature guide plus manual test scripts for every
// shipped module, so a Church Administrator (or a QA reviewer) can see
// what a module is supposed to do and verify it themselves, one numbered
// step at a time, against the running demo tenant.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, Search, ExternalLink } from 'lucide-react';
import { knowledgeBaseModules } from '../../../lib/knowledge-base-content';

export default function HelpPage() {
  const [search, setSearch] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(knowledgeBaseModules[0].slug);

  const filtered = useMemo(() => {
    if (!search.trim()) return knowledgeBaseModules;
    const q = search.toLowerCase();
    return knowledgeBaseModules.filter(
      (m) => m.title.toLowerCase().includes(q) || m.summary.toLowerCase().includes(q) || m.moduleLabel.toLowerCase().includes(q),
    );
  }, [search]);

  const selected = knowledgeBaseModules.find((m) => m.slug === selectedSlug) ?? knowledgeBaseModules[0];
  const completeCount = knowledgeBaseModules.filter((m) => m.status === 'complete').length;
  const partialCount = knowledgeBaseModules.filter((m) => m.status === 'partial').length;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Knowledge Base</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Feature Guide &amp; Test Scripts</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            What each module does, the requirements it satisfies, and step-by-step scripts you can run yourself
            against the demo tenant to verify it works.
          </p>
        </header>

        <div className="flex flex-wrap gap-3 mb-8">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2} />
            <span className="text-sm text-slate-700">
              <strong className="font-serif text-base text-[#1E2A44]">{completeCount}</strong> fully covered
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" strokeWidth={2} />
            <span className="text-sm text-slate-700">
              <strong className="font-serif text-base text-[#1E2A44]">{partialCount}</strong> partially covered
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          <div className="lg:sticky lg:top-6">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search features…"
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
              />
            </div>
            <nav className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-50">
              {filtered.map((m) => (
                <button
                  key={m.slug}
                  onClick={() => setSelectedSlug(m.slug)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    selected.slug === m.slug ? 'bg-[#1E2A44]/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <m.icon className="h-4 w-4 text-[#1E2A44] shrink-0" strokeWidth={2} />
                  <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{m.title}</span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${m.status === 'complete' ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    title={m.status === 'complete' ? 'Fully covered' : 'Partially covered'}
                  />
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-slate-400">No matches.</div>
              )}
            </nav>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-[#1E2A44]/5 flex items-center justify-center shrink-0">
                  <selected.icon className="h-5 w-5 text-[#1E2A44]" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{selected.moduleLabel}</p>
                  <h2 className="font-serif text-xl text-[#1E2A44] truncate">{selected.title}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                    selected.status === 'complete'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-amber-700 bg-amber-50 border-amber-200'
                  }`}
                >
                  {selected.status === 'complete' ? 'Fully covered' : 'Partially covered'}
                </span>
                {selected.path && (
                  <Link
                    href={selected.path}
                    className="text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-[#1E2A44]/30 inline-flex items-center gap-1"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6 max-w-3xl leading-relaxed">{selected.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <h3 className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-2.5">Requirements covered</h3>
                <ul className="space-y-2">
                  {selected.requirements.map((r, i) => (
                    <li key={i} className="text-sm text-slate-600 flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2} />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {selected.knownGaps && selected.knownGaps.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-2.5">Known gaps</h3>
                  <ul className="space-y-2">
                    {selected.knownGaps.map((g, i) => (
                      <li key={i} className="text-sm text-slate-600 flex gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" strokeWidth={2} />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <h3 className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-3">Test scripts</h3>
            <div className="space-y-4">
              {selected.scenarios.map((s, i) => (
                <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                  <p className="text-sm font-medium text-[#1E2A44] mb-3">{s.title}</p>
                  <ol className="space-y-2">
                    {s.steps.map((step, j) => (
                      <li key={j} className="text-sm text-slate-600 flex gap-2.5">
                        <span className="shrink-0 h-5 w-5 rounded-full bg-[#1E2A44] text-white text-[11px] font-medium flex items-center justify-center mt-0.5">
                          {j + 1}
                        </span>
                        <span className="pt-px">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
