'use client';

// app/admin/settings/menus/page.tsx
// The Dynamic Menu Builder — admin-configured navigation, additive to the
// frontend's static default nav (a tenant with zero menu items sees exactly
// what it always saw). Items point at a module/entity/report/dashboard/
// customPage/workflow via a target path, support parent/child nesting, and
// can be restricted by role and/or branch.

import { useEffect, useState } from 'react';
import {
  branchesApi,
  Branch,
  getCurrentTenant,
  MenuItem,
  MenuItemTargetType,
  menuItemsApi,
  rolesApi,
  Role,
  isAccessDeniedResponse,
} from '../../../../lib/api';
import { IconPicker } from '../../../../components/icon-picker';
import { AccessDenied } from '../../../../components/access-denied';

const TARGET_TYPES: { value: MenuItemTargetType; label: string }[] = [
  { value: 'module', label: 'Built-in module' },
  { value: 'entity', label: 'Dynamic entity' },
  { value: 'report', label: 'Report' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'customPage', label: 'Custom page' },
  { value: 'workflow', label: 'Workflow' },
];

export default function MenusAdminPage() {
  const tenant = getCurrentTenant();
  const tenantSlug = tenant?.slug ?? '';

  const [items, setItems] = useState<MenuItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('');
  const [targetType, setTargetType] = useState<MenuItemTargetType>('customPage');
  const [targetKey, setTargetKey] = useState('');
  const [parentMenuItemId, setParentMenuItemId] = useState('');
  const [visibleToRoleNames, setVisibleToRoleNames] = useState<Set<string>>(new Set());
  const [visibleToBranchId, setVisibleToBranchId] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const [itemsRes, rolesRes, branchesRes] = await Promise.all([
      menuItemsApi.list(tenantSlug),
      rolesApi.list(tenantSlug),
      branchesApi.list(tenantSlug),
    ]);
    if (isAccessDeniedResponse(itemsRes)) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    if (itemsRes.success && itemsRes.data) setItems(itemsRes.data);
    else setError(itemsRes.error?.message ?? 'Could not load menu items.');
    if (rolesRes.success && rolesRes.data) setRoles(rolesRes.data);
    if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
    setLoading(false);
  }

  useEffect(() => {
    if (tenantSlug) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  function toggleRole(name: string) {
    setVisibleToRoleNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !targetKey.trim()) return;
    setSaving(true);
    setError(null);

    const res = await menuItemsApi.create(tenantSlug, {
      label: label.trim(),
      icon: icon.trim() || undefined,
      targetType,
      targetKey: targetKey.trim(),
      parentMenuItemId: parentMenuItemId || undefined,
      visibleToRoleNames: Array.from(visibleToRoleNames),
      visibleToBranchId: visibleToBranchId || undefined,
      sortOrder: items.length,
    });

    if (res.success) {
      setLabel('');
      setIcon('');
      setTargetKey('');
      setParentMenuItemId('');
      setVisibleToRoleNames(new Set());
      setVisibleToBranchId('');
      load();
    } else {
      setError(res.error?.message ?? 'Could not create menu item.');
    }
    setSaving(false);
  }

  async function handleToggleActive(item: MenuItem) {
    const res = await menuItemsApi.update(tenantSlug, item.id, { isActive: !item.isActive });
    if (res.success) load();
  }

  async function handleDelete(item: MenuItem) {
    if (!confirm(`Delete menu item "${item.label}"?`)) return;
    const res = await menuItemsApi.remove(tenantSlug, item.id);
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not delete menu item.');
  }

  const topLevel = items.filter((i) => !i.parentMenuItemId);
  const childrenOf = (id: string) => items.filter((i) => i.parentMenuItemId === id);

  if (accessDenied) return <AccessDenied />;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Center</p>
        <h1 className="font-serif text-3xl text-[#1E2A44]">Menu Builder</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Configure navigation without code. Nothing changes for this church until you add an item here — the
          default menu keeps working exactly as before.
        </p>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

      <div className="grid md:grid-cols-[1fr_1.3fr] gap-8">
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-5 h-fit space-y-3">
          <h2 className="font-serif text-lg text-[#1E2A44]">New menu item</h2>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Prayer Requests"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Target type</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as MenuItemTargetType)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700"
              >
                {TARGET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Icon (optional)</label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Target path</label>
            <input
              value={targetKey}
              onChange={(e) => setTargetKey(e.target.value)}
              placeholder="/admin/modules/prayer-requests"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Parent menu item</label>
            <select
              value={parentMenuItemId}
              onChange={(e) => setParentMenuItemId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700"
            >
              <option value="">Top level</option>
              {topLevel.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Visible to roles (blank = everyone)</label>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => toggleRole(r.name)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    visibleToRoleNames.has(r.name)
                      ? 'bg-[#1E2A44] text-white border-[#1E2A44]'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Visible to branch (blank = everyone)</label>
            <select
              value={visibleToBranchId}
              onChange={(e) => setVisibleToBranchId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700"
            >
              <option value="">Every branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: '#1E2A44' }}
          >
            {saving ? 'Adding…' : 'Add menu item'}
          </button>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden h-fit">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : topLevel.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No menu items configured — the default sidebar is shown as-is.
            </div>
          ) : (
            topLevel.map((item) => (
              <div key={item.id}>
                <MenuItemRow item={item} onToggle={handleToggleActive} onDelete={handleDelete} />
                {childrenOf(item.id).map((child) => (
                  <div key={child.id} className="pl-6 border-t border-slate-50">
                    <MenuItemRow item={child} onToggle={handleToggleActive} onDelete={handleDelete} />
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: MenuItem;
  onToggle: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
}) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-800">{item.label}</p>
        <p className="text-xs text-slate-400">
          {item.targetType} · {item.targetKey}
          {item.visibleToRoleNames.length > 0 && <> · roles: {item.visibleToRoleNames.join(', ')}</>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle(item)}
          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
            item.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}
        >
          {item.isActive ? 'Active' : 'Inactive'}
        </button>
        <button onClick={() => onDelete(item)} className="text-xs text-red-500 hover:underline">
          Delete
        </button>
      </div>
    </div>
  );
}
