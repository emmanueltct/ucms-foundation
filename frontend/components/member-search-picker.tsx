'use client';

// components/member-search-picker.tsx
// Search-and-select an already-registered Member — the frontend half of
// "a person must be a registered member before joining any entity": every
// entity-membership screen picks from existing Members, never creates a new
// one. Shared by the generic Dynamic Module records page's membership panel
// (app/admin/modules/[key]/page.tsx); the two existing hand-rolled
// Ministry/Small Group roster screens keep their own inline <select> for
// now — this component is additive, not a forced rewrite of either.

import { useState } from 'react';
import { Member } from '../lib/api';
import { Input } from './ui/input';

interface MemberSearchPickerProps {
  members: Member[];
  value: string;
  onChange: (memberId: string) => void;
  placeholder?: string;
}

export function MemberSearchPicker({ members, value, onChange, placeholder }: MemberSearchPickerProps) {
  const [query, setQuery] = useState('');

  const selected = members.find((m) => m.id === value) ?? null;
  const filtered =
    query.trim().length === 0
      ? []
      : members
          .filter((m) => `${m.firstName} ${m.lastName}`.toLowerCase().includes(query.trim().toLowerCase()))
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
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder ?? 'Search members by name…'} />
      {filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 rounded-lg border border-slate-200 bg-white shadow-md overflow-hidden max-h-56 overflow-y-auto">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onChange(m.id);
                setQuery('');
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {m.firstName} {m.lastName}
              {m.membershipNumber ? <span className="text-xs text-slate-400"> · {m.membershipNumber}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
