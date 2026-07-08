'use client';

// app/admin/config/page.tsx
// Lets a Church Administrator manage tenant-specific configuration
// (ministries, contribution types, ceremony names, membership categories...)
// through the generic Configuration Engine — no code change required.

import { useEffect, useState } from 'react';
import { configApi } from '../../../lib/api';

const NAMESPACES = [
  { value: 'branch_type', label: 'Branch Types' },
  { value: 'membership_category', label: 'Membership Categories' },
  { value: 'contribution_type', label: 'Contribution Types' },
  { value: 'service_type', label: 'Service Types' },
  { value: 'attendance_method', label: 'Attendance Methods' },
  { value: 'ministry_type', label: 'Ministry Types' },
  { value: 'small_group_type', label: 'Small Group Types' },
  { value: 'event_type', label: 'Event Types' },
  { value: 'staff_position', label: 'Staff Positions' },
  { value: 'department', label: 'Departments' },
  { value: 'asset_category', label: 'Asset Categories' },
  { value: 'asset_condition', label: 'Asset Conditions' },
  { value: 'visitor_source', label: 'Visitor Sources' },
  { value: 'follow_up_method', label: 'Follow-up Methods' },
  { value: 'document_category', label: 'Document Categories' },
];

interface ConfigItem {
  id: string;
  namespace: string;
  key: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
}

const TENANT_SLUG = 'demo-church'; // in production this comes from the resolved workspace/domain

export default function ConfigAdminPage() {
  const [namespace, setNamespace] = useState(NAMESPACES[0].value);
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await configApi.listByNamespace(TENANT_SLUG, namespace);
    if (res.success && res.data) {
      setItems(res.data as ConfigItem[]);
    } else {
      setError(res.error?.message ?? 'Could not load configuration.');
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    const key = newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const res = await configApi.create(TENANT_SLUG, { namespace, key, label: newLabel.trim(), value: {} });
    if (res.success) {
      setNewLabel('');
      load();
    } else {
      setError(res.error?.message ?? 'Could not add item.');
    }
  }

  async function handleToggle(item: ConfigItem) {
    const res = item.isActive
      ? await configApi.deactivate(TENANT_SLUG, item.id)
      : await configApi.reactivate(TENANT_SLUG, item.id);
    if (res.success) load();
  }

  const currentLabel = NAMESPACES.find((n) => n.value === namespace)?.label ?? namespace;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Engine</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Set up {currentLabel.toLowerCase()}</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            These lists are entirely yours — add, rename, or retire entries any time. Nothing here requires a
            developer or a code change; every other module (finance, events, membership...) reads from what you
            set up here.
          </p>
        </header>

        <div className="flex gap-2 mb-6 flex-wrap">
          {NAMESPACES.map((ns) => (
            <button
              key={ns.value}
              onClick={() => setNamespace(ns.value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                ns.value === namespace
                  ? 'bg-[#1E2A44] text-white border-[#1E2A44]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {ns.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={`Add a new ${currentLabel.toLowerCase().replace(/s$/, '')}…`}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
          />
          <button
            type="submit"
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: '#1E2A44' }}
          >
            Add
          </button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              Nothing here yet. Add your first {currentLabel.toLowerCase().replace(/s$/, '')} above.
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className={`text-sm font-medium ${item.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-400">{item.key}</p>
                </div>
                <button
                  onClick={() => handleToggle(item)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                >
                  {item.isActive ? 'Retire' : 'Restore'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
