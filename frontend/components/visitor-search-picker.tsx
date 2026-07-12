'use client';

// components/visitor-search-picker.tsx
// Search-and-select one existing Visitor — mirrors member-search-picker.tsx
// exactly (same shape, deliberately not generalized into a shared component;
// see that file's comment for why). Used by the Dynamic Module Builder's
// assignment panel to attach a request directly to one specific visitor.

import { useState } from 'react';
import { Visitor } from '../lib/api';
import { Input } from './ui/input';

interface VisitorSearchPickerProps {
  visitors: Visitor[];
  value: string;
  onChange: (visitorId: string) => void;
  placeholder?: string;
}

export function VisitorSearchPicker({ visitors, value, onChange, placeholder }: VisitorSearchPickerProps) {
  const [query, setQuery] = useState('');

  const selected = visitors.find((v) => v.id === value) ?? null;
  const filtered =
    query.trim().length === 0
      ? []
      : visitors
          .filter((v) => `${v.firstName} ${v.lastName}`.toLowerCase().includes(query.trim().toLowerCase()))
          .slice(0, 8);

  if (selected) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 h-8 flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-800">
          {selected.firstName} {selected.lastName}
        </span>
        <button
          onClick={() => {
            onChange('');
            setQuery('');
          }}
          className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder ?? 'Search visitors by name…'} />
      {filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 rounded-lg border border-slate-200 bg-white shadow-md overflow-hidden max-h-56 overflow-y-auto">
          {filtered.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                onChange(v.id);
                setQuery('');
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {v.firstName} {v.lastName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
