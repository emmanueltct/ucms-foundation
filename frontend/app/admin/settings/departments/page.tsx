'use client';

// app/admin/settings/departments/page.tsx
// Lets a Denomination Admin create dynamic (non-hardcoded) departments —
// Finance, HR, Customer Care, Logistics, Administration, ICT, Procurement,
// Communications, or any custom name — and assign modules/reports/
// dashboards/workflows to each. Departments are Dynamic Module Records
// under one pre-seeded "departments" module (see DepartmentsService), not a
// new model, so this page is a thin CRUD + resource-assignment picker over
// that.

import { useEffect, useState } from 'react';
import { departmentsApi, dynamicModuleDefinitionsApi, Department, DynamicModuleDefinition, ResourceAssignment } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';

const TENANT_SLUG = 'demo-church';

const RESOURCE_TYPES = [
  { value: 'module', label: 'Module' },
  { value: 'report', label: 'Report' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'document_category', label: 'Document Category' },
];

export default function DepartmentsAdminPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [modules, setModules] = useState<DynamicModuleDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<Department | null>(null);
  const [resources, setResources] = useState<ResourceAssignment[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourceType, setResourceType] = useState('module');
  const [resourceKey, setResourceKey] = useState('');
  const [assigning, setAssigning] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const [deptRes, moduleRes] = await Promise.all([
      departmentsApi.list(TENANT_SLUG),
      dynamicModuleDefinitionsApi.list(TENANT_SLUG, undefined, true),
    ]);
    if (deptRes.success && deptRes.data) setDepartments(deptRes.data);
    else setError(deptRes.error?.message ?? 'Could not load departments.');
    if (moduleRes.success && moduleRes.data) setModules(moduleRes.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function loadResources(dept: Department) {
    setSelected(dept);
    setResourcesLoading(true);
    const res = await departmentsApi.listResources(TENANT_SLUG, dept.id);
    if (res.success && res.data) setResources(res.data);
    else setError(res.error?.message ?? 'Could not load assigned resources.');
    setResourcesLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    const res = await departmentsApi.create(TENANT_SLUG, { name: name.trim() });
    if (res.success) {
      setName('');
      load();
    } else {
      setError(res.error?.message ?? 'Could not create the department.');
    }
    setCreating(false);
  }

  async function handleDelete(dept: Department) {
    if (!confirm(`Delete department "${dept.title}"? It's restorable from Configuration Center > Trash-adjacent module views.`)) return;
    const res = await departmentsApi.remove(TENANT_SLUG, dept.id);
    if (res.success) {
      if (selected?.id === dept.id) setSelected(null);
      load();
    } else {
      setError(res.error?.message ?? 'Could not delete the department.');
    }
  }

  async function handleAssignResource(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !resourceKey) return;
    setAssigning(true);
    setError(null);
    const res = await departmentsApi.assignResource(TENANT_SLUG, selected.id, { resourceType, resourceKey });
    if (res.success) {
      setResourceKey('');
      loadResources(selected);
    } else {
      setError(res.error?.message ?? 'Could not assign this resource.');
    }
    setAssigning(false);
  }

  async function handleRemoveResource(assignment: ResourceAssignment) {
    if (!selected) return;
    const res = await departmentsApi.removeResource(TENANT_SLUG, selected.id, assignment.id);
    if (res.success) loadResources(selected);
    else setError(res.error?.message ?? 'Could not remove this assignment.');
  }

  function moduleLabel(key: string): string {
    return modules.find((m) => m.id === key)?.label ?? key;
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Center</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Departments</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Finance, HR, Customer Care, Logistics, Administration, ICT, Procurement, Communications — or any custom
            department this church needs. Assign modules, reports, dashboards, and workflows to each so its
            leader/staff automatically get access to only what&apos;s relevant.
          </p>
        </header>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="dept-name" className="mb-1 text-slate-600">
              New department name
            </Label>
            <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Finance" />
          </div>
          <Button type="submit" disabled={creating} style={{ backgroundColor: '#1E2A44' }}>
            {creating ? 'Adding…' : 'Add department'}
          </Button>
        </form>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden h-fit">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : departments.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No departments yet — add one above.</div>
            ) : (
              departments.map((dept) => (
                <div
                  key={dept.id}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                    selected?.id === dept.id ? 'bg-[#1E2A44]/5' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => loadResources(dept)}
                >
                  <span className="text-sm font-medium text-slate-800">{dept.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(dept);
                    }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {!selected ? (
              <div className="py-8 text-center text-sm text-slate-400">Select a department to manage its assigned resources.</div>
            ) : (
              <>
                <h2 className="font-serif text-lg text-[#1E2A44] mb-3">{selected.title}</h2>

                <form onSubmit={handleAssignResource} className="space-y-2 mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="mb-1 text-slate-600">Resource type</Label>
                      <select
                        value={resourceType}
                        onChange={(e) => {
                          setResourceType(e.target.value);
                          setResourceKey('');
                        }}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700"
                      >
                        {RESOURCE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="mb-1 text-slate-600">Resource</Label>
                      {resourceType === 'module' ? (
                        <select
                          value={resourceKey}
                          onChange={(e) => setResourceKey(e.target.value)}
                          className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700"
                        >
                          <option value="">— Select —</option>
                          {modules.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input value={resourceKey} onChange={(e) => setResourceKey(e.target.value)} placeholder="key" />
                      )}
                    </div>
                  </div>
                  <Button type="submit" size="sm" disabled={assigning || !resourceKey} style={{ backgroundColor: '#1E2A44' }}>
                    {assigning ? 'Assigning…' : 'Assign'}
                  </Button>
                </form>

                <p className="text-xs text-slate-400 mb-2">Assigned resources</p>
                {resourcesLoading ? (
                  <div className="py-4 text-center text-sm text-slate-400">Loading…</div>
                ) : resources.length === 0 ? (
                  <p className="text-sm text-slate-400">Nothing assigned yet.</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {resources.map((r) => (
                      <div key={r.id} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm text-slate-700">{r.resourceType === 'module' ? moduleLabel(r.resourceKey) : r.resourceKey}</p>
                          <p className="text-xs text-slate-400">{r.resourceType}</p>
                        </div>
                        <button onClick={() => handleRemoveResource(r)} className="text-xs text-red-500 hover:underline">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
