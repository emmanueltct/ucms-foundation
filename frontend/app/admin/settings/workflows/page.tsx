'use client';

// app/admin/settings/workflows/page.tsx
// The Workflow Builder — a UI for ApprovalWorkflow/ApprovalStep, which the
// backend has always fully supported (used today only as a dropdown source
// on the Dynamic Module Builder page). Steps are immutable once created —
// delete and recreate the workflow to change its step chain, matching the
// backend's own documented design decision.

import { useEffect, useState } from 'react';
import { approvalWorkflowsApi, ApprovalWorkflow, getCurrentTenant, permissionsApi, Permission, rolesApi, Role } from '../../../../lib/api';

interface StepDraft {
  label: string;
  gateType: 'role' | 'permission';
  approverRoleName: string;
  approverPermissionCode: string;
}

function emptyStep(): StepDraft {
  return { label: '', gateType: 'role', approverRoleName: '', approverPermissionCode: '' };
}

export default function WorkflowsAdminPage() {
  const tenant = getCurrentTenant();
  const tenantSlug = tenant?.slug ?? '';

  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entityType, setEntityType] = useState('');
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep()]);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const [wfRes, rolesRes, permsRes] = await Promise.all([
      approvalWorkflowsApi.list(tenantSlug),
      rolesApi.list(tenantSlug),
      permissionsApi.list(tenantSlug),
    ]);
    if (wfRes.success && wfRes.data) setWorkflows(wfRes.data);
    else setError(wfRes.error?.message ?? 'Could not load workflows.');
    if (rolesRes.success && rolesRes.data) setRoles(rolesRes.data);
    if (permsRes.success && permsRes.data) setPermissions(permsRes.data);
    setLoading(false);
  }

  useEffect(() => {
    if (tenantSlug) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyStep()]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!entityType.trim() || !name.trim() || steps.some((s) => !s.label.trim())) return;
    setSaving(true);
    setError(null);

    const res = await approvalWorkflowsApi.create(tenantSlug, {
      entityType: entityType.trim(),
      name: name.trim(),
      steps: steps.map((s) => ({
        label: s.label.trim(),
        approverRoleName: s.gateType === 'role' ? s.approverRoleName || undefined : undefined,
        approverPermissionCode: s.gateType === 'permission' ? s.approverPermissionCode || undefined : undefined,
      })),
    });

    if (res.success) {
      setEntityType('');
      setName('');
      setSteps([emptyStep()]);
      load();
    } else {
      setError(res.error?.message ?? 'Could not create workflow.');
    }
    setSaving(false);
  }

  async function handleToggleActive(wf: ApprovalWorkflow) {
    const res = await approvalWorkflowsApi.update(tenantSlug, wf.id, { isActive: !wf.isActive });
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not update workflow.');
  }

  async function handleDelete(wf: ApprovalWorkflow) {
    if (!confirm(`Delete workflow "${wf.name}"? This only works if it has no approval history yet.`)) return;
    const res = await approvalWorkflowsApi.remove(tenantSlug, wf.id);
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not delete workflow.');
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration Center</p>
        <h1 className="font-serif text-3xl text-[#1E2A44]">Workflow Builder</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Define an ordered approval chain for anything that needs sign-off — member registrations, dynamic module
          records, hierarchy requirement submissions. Each step is gated by a role or a permission.
        </p>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

      <div className="grid md:grid-cols-[1.1fr_1.4fr] gap-8">
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-5 h-fit space-y-4">
          <h2 className="font-serif text-lg text-[#1E2A44]">New workflow</h2>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Entity type</label>
            <input
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              placeholder="member_registration"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
              required
            />
            <p className="text-xs text-slate-400 mt-1">The identifier callers pass when starting/deciding a request.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Workflow name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Standard member approval"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20 focus:border-[#1E2A44]"
              required
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-600">Steps, in order</p>
            {steps.map((step, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-4">{i + 1}.</span>
                  <input
                    value={step.label}
                    onChange={(e) => updateStep(i, { label: e.target.value })}
                    placeholder="Step label"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                    required
                  />
                  {steps.length > 1 && (
                    <button type="button" onClick={() => removeStep(i)} className="text-xs text-red-500 hover:underline">
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <select
                    value={step.gateType}
                    onChange={(e) => updateStep(i, { gateType: e.target.value as 'role' | 'permission' })}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                  >
                    <option value="role">Approver has role</option>
                    <option value="permission">Approver has permission</option>
                  </select>
                  {step.gateType === 'role' ? (
                    <select
                      value={step.approverRoleName}
                      onChange={(e) => updateStep(i, { approverRoleName: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                    >
                      <option value="">Any signed-in user</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={step.approverPermissionCode}
                      onChange={(e) => updateStep(i, { approverPermissionCode: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                    >
                      <option value="">Any signed-in user</option>
                      {permissions.map((p) => (
                        <option key={p.id} value={p.code}>
                          {p.code}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={addStep} className="text-xs text-[#1E2A44] hover:underline">
              + Add step
            </button>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: '#1E2A44' }}
          >
            {saving ? 'Creating…' : 'Create workflow'}
          </button>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden h-fit">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : workflows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No workflows defined yet.</div>
          ) : (
            workflows.map((wf) => (
              <div key={wf.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{wf.name}</p>
                    <p className="text-xs text-slate-400">{wf.entityType}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(wf)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                        wf.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {wf.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button onClick={() => handleDelete(wf)} className="text-xs text-red-500 hover:underline">
                      Delete
                    </button>
                  </div>
                </div>
                <ol className="mt-2 space-y-0.5">
                  {wf.steps.map((s) => (
                    <li key={s.id} className="text-xs text-slate-500">
                      {s.stepOrder}. {s.label}
                      {s.approverRoleName && <span className="text-slate-400"> — role: {s.approverRoleName}</span>}
                      {s.approverPermissionCode && <span className="text-slate-400"> — permission: {s.approverPermissionCode}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
