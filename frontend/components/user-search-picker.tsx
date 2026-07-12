'use client';

// components/user-search-picker.tsx
// Search-and-select one existing staff User — mirrors member-search-picker.tsx
// exactly (same shape, deliberately not generalized into a shared component;
// see that file's comment for why). Used by the Dynamic Module Builder's
// assignment panel to attach a request directly to one specific staff member.

import { useState } from 'react';
import { AppUser } from '../lib/api';
import { Input } from './ui/input';

interface UserSearchPickerProps {
  users: AppUser[];
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
}

export function UserSearchPicker({ users, value, onChange, placeholder }: UserSearchPickerProps) {
  const [query, setQuery] = useState('');

  const selected = users.find((u) => u.id === value) ?? null;
  const filtered =
    query.trim().length === 0
      ? []
      : users
          .filter((u) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(query.trim().toLowerCase()))
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
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder ?? 'Search staff by name…'} />
      {filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 rounded-lg border border-slate-200 bg-white shadow-md overflow-hidden max-h-56 overflow-y-auto">
          {filtered.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                onChange(u.id);
                setQuery('');
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {u.firstName} {u.lastName}
              <span className="text-xs text-slate-400"> · {u.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
