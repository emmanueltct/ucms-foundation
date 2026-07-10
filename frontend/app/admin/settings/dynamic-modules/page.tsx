'use client';

// app/admin/settings/dynamic-modules/page.tsx
// The Dynamic Module Builder — lets a Church Administrator define an
// entirely new functional module (its own record type, its own statuses,
// optionally its own approval workflow) with zero code changes. Custom
// fields for a module are defined on the existing Custom Fields settings
// page, entityType `dynamicmodule:{id}` — this page only builds the module
// shell itself.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { dynamicModuleDefinitionsApi, approvalWorkflowsApi, DynamicModuleDefinition, ApprovalWorkflow } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';

const TENANT_SLUG = 'demo-church';

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function DynamicModulesAdminPage() {
  const [modules, setModules] = useState<DynamicModuleDefinition[]>([]);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [statusesText, setStatusesText] = useState('open, closed');
  const [attachableText, setAttachableText] = useState('');
  const [approvalWorkflowId, setApprovalWorkflowId] = useState('');
  const [showInNav, setShowInNav] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [modulesRes, workflowsRes] = await Promise.all([
        dynamicModuleDefinitionsApi.list(TENANT_SLUG),
        approvalWorkflowsApi.list(TENANT_SLUG),
      ]);
      if (modulesRes.success && modulesRes.data) setModules(modulesRes.data);
      else setError(modulesRes.error?.message ?? 'Could not load modules.');
      if (workflowsRes.success && workflowsRes.data) setWorkflows(workflowsRes.data);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleLabelChange(value: string) {
    setLabel(value);
    if (!keyEdited) setKey(slugify(value));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !key.trim()) return;
    try {
      const res = await dynamicModuleDefinitionsApi.create(TENANT_SLUG, {
        key: key.trim(),
        label: label.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        statuses: statusesText.split(',').map((s) => s.trim()).filter(Boolean),
        attachableToEntityTypes: attachableText.split(',').map((s) => s.trim()).filter(Boolean),
        approvalWorkflowId: approvalWorkflowId || undefined,
        showInNav,
      });
      if (res.success) {
        setLabel('');
        setKey('');
        setKeyEdited(false);
        setDescription('');
        setIcon('');
        setStatusesText('open, closed');
        setAttachableText('');
        setApprovalWorkflowId('');
        setShowInNav(false);
        load();
      } else {
        setError(res.error?.message ?? 'Could not create the module.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleToggleNav(mod: DynamicModuleDefinition) {
    try {
      const res = await dynamicModuleDefinitionsApi.update(TENANT_SLUG, mod.id, { showInNav: !mod.showInNav });
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not update the module.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemove(id: string) {
    try {
      const res = await dynamicModuleDefinitionsApi.remove(TENANT_SLUG, id);
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not remove the module.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Configuration</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Dynamic Module Builder</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Define an entirely new functional module — your own record type, statuses, and
            optional approval workflow — with no code change. Add custom fields for a
            module afterward on the{' '}
            <Link href="/admin/settings/custom-fields" className="underline">
              Custom Fields
            </Link>{' '}
            page.
          </p>
        </header>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="dm-label" className="mb-1 text-slate-600">Label</Label>
              <Input id="dm-label" value={label} onChange={(e) => handleLabelChange(e.target.value)} placeholder="Committee Requests" />
            </div>
            <div>
              <Label htmlFor="dm-key" className="mb-1 text-slate-600">Key (used in the URL)</Label>
              <Input
                id="dm-key"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setKeyEdited(true);
                }}
                placeholder="committee-requests"
              />
            </div>
            <div>
              <Label htmlFor="dm-icon" className="mb-1 text-slate-600">Icon name (optional)</Label>
              <Input id="dm-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="clipboard-list" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="dm-description" className="mb-1 text-slate-600">Description (optional)</Label>
              <Input id="dm-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this module for?" />
            </div>
            <div>
              <Label htmlFor="dm-statuses" className="mb-1 text-slate-600">Statuses (comma-separated, in order)</Label>
              <Input id="dm-statuses" value={statusesText} onChange={(e) => setStatusesText(e.target.value)} placeholder="open, in_review, approved, rejected" />
            </div>
            <div>
              <Label htmlFor="dm-attachable" className="mb-1 text-slate-600">Attachable to (comma-separated, optional)</Label>
              <Input id="dm-attachable" value={attachableText} onChange={(e) => setAttachableText(e.target.value)} placeholder="branch, ministry, member" />
            </div>
            <div>
              <Label htmlFor="dm-workflow" className="mb-1 text-slate-600">Approval workflow (optional)</Label>
              <select
                id="dm-workflow"
                value={approvalWorkflowId}
                onChange={(e) => setApprovalWorkflowId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— None —</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input id="dm-nav" type="checkbox" checked={showInNav} onChange={(e) => setShowInNav(e.target.checked)} />
              <Label htmlFor="dm-nav" className="text-slate-600">Show in sidebar navigation</Label>
            </div>
          </div>
          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>Create module</Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : modules.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No modules yet. Create your first one above.</div>
          ) : (
            modules.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{m.label}</p>
                  <p className="text-xs text-slate-400">
                    {m.key} · {m.statuses.join(' → ')} · custom fields entityType:{' '}
                    <code className="text-[11px]">dynamicmodule:{m.id}</code>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/modules/${m.key}`}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                  >
                    Manage records
                  </Link>
                  <button
                    onClick={() => handleToggleNav(m)}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                  >
                    {m.showInNav ? 'Hide from nav' : 'Show in nav'}
                  </button>
                  <button
                    onClick={() => handleRemove(m.id)}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
