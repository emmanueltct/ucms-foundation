'use client';

// app/admin/settings/roles/page.tsx
// Roles & Permissions — the backend (RolesController/PermissionsController)
// has always supported full CRUD here; this is the first UI for it. Roles
// are created/edited with a permission checklist grouped by module; system
// roles (e.g. "Church Administrator") are locked, matching the backend.

import { useEffect, useState } from 'react';
import { getCurrentTenant, permissionsApi, Permission, rolesApi, Role } from '../../../../lib/api';

export default function RolesAdminPage() {
  const tenant = getCurrentTenant();
  const tenantSlug = tenant?.slug ?? '';

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDelegable, setIsDelegable] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const [rolesRes, permsRes] = await Promise.all([rolesApi.list(tenantSlug), permissionsApi.list(tenantSlug)]);
    if (rolesRes.success && rolesRes.data) setRoles(rolesRes.data);
    else setError(rolesRes.error?.message ?? 'Could not load roles.');
    if (permsRes.success && permsRes.data) setPermissions(permsRes.data);
    setLoading(false);
  }

  useEffect(() => {
    if (tenantSlug) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  function startNew() {
    setSelectedRoleId(null);
    setName('');
    setDescription('');
    setIsDelegable(false);
    setSelectedCodes(new Set());
  }

  function startEdit(role: Role) {
    setSelectedRoleId(role.id);
    setName(role.name);
    setDescription(role.description ?? '');
    setIsDelegable(role.isDelegable);
    setSelectedCodes(new Set(role.rolePermissions.map((rp) => rp.permission.code)));
  }

  function toggleCode(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleModule(codes: string[], allSelected: boolean) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      codes.forEach((c) => (allSelected ? next.delete(c) : next.add(c)));
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      permissionCodes: Array.from(selectedCodes),
      isDelegable,
    };
    const res = selectedRoleId ? await rolesApi.update(tenantSlug, selectedRoleId, body) : await rolesApi.create(tenantSlug, body);

    if (res.success) {
      startNew();
      load();
    } else {
      setError(res.error?.message ?? 'Could not save role.');
    }
    setSaving(false);
  }

  async function handleDelete(role: Role) {
    if (role.isSystem) return;
    if (!confirm(`Delete role "${role.name}"?`)) return;
    const res = await rolesApi.remove(tenantSlug, role.id);
    if (res.success) {
      if (selectedRoleId === role.id) startNew();
      load();
    } else {
      setError(res.error?.message ?? 'Could not delete role.');
    }
  }

  const byModule = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const isLocked = !!selectedRole?.isSystem;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Center</p>
        <h1 className="font-serif text-3xl text-[#1E2A44]">Roles &amp; permissions</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Create custom roles and assign exactly the permissions each one needs. System roles are locked and can&apos;t
          be edited or deleted.
        </p>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden h-fit">
          <button
            onClick={startNew}
            className={`w-full text-left px-4 py-3 text-sm font-medium ${
              selectedRoleId === null ? 'bg-[#1E2A44]/5 text-[#1E2A44]' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            + New role
          </button>
          {loading ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Loading…</div>
          ) : (
            roles.map((role) => (
              <button
                key={role.id}
                onClick={() => startEdit(role)}
                className={`w-full text-left px-4 py-3 text-sm ${
                  selectedRoleId === role.id ? 'bg-[#1E2A44]/5 text-[#1E2A44] font-medium' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {role.name}
                {role.isSystem && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-400">system</span>}
              </button>
            ))
          )}
        </div>

        <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLocked}
                placeholder="Finance Officer"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44] disabled:bg-slate-50 disabled:text-slate-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLocked}
                placeholder="Manages contributions and expense approvals"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44] disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700 mb-4">
            <input
              type="checkbox"
              checked={isDelegable}
              onChange={(e) => setIsDelegable(e.target.checked)}
              disabled={isLocked}
              className="mt-0.5"
            />
            <span>
              Delegable
              <span className="block text-xs text-slate-400">
                A Department Leader may assign this role to staff within their own department, without needing full
                user-management access.
              </span>
            </span>
          </label>

          {isLocked && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 mb-4">
              This is a system role — its permissions can&apos;t be changed.
            </div>
          )}

          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {Object.entries(byModule).map(([module, perms]) => {
              const allSelected = perms.every((p) => selectedCodes.has(p.code));
              return (
                <div key={module}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{module}</p>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => toggleModule(perms.map((p) => p.code), allSelected)}
                        className="text-xs text-[#1E2A44] hover:underline"
                      >
                        {allSelected ? 'Clear' : 'Select all'}
                      </button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    {perms.map((p) => (
                      <label key={p.id} className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedCodes.has(p.code)}
                          onChange={() => toggleCode(p.code)}
                          disabled={isLocked}
                          className="mt-0.5"
                        />
                        <span>
                          {p.code}
                          <span className="block text-xs text-slate-400">{p.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving || isLocked}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: '#1E2A44' }}
            >
              {saving ? 'Saving…' : selectedRoleId ? 'Save changes' : 'Create role'}
            </button>
            {selectedRole && !isLocked && (
              <button
                type="button"
                onClick={() => handleDelete(selectedRole)}
                className="text-sm text-red-600 hover:underline"
              >
                Delete role
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
