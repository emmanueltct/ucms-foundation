'use client';

// app/admin/hierarchy-requirements/page.tsx
// Lets a Church Administrator define what each organizational level requires
// of the level directly beneath it (e.g. "every District must submit a
// monthly activity report to its Diocese"), and review submissions against
// those requirements across all branches.

import { useEffect, useState } from 'react';
import {
  hierarchyRequirementsApi,
  branchesApi,
  HierarchyRequirement,
  HierarchyRequirementSubmission,
  Branch,
} from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const TENANT_SLUG = 'demo-church';
const KINDS = ['report', 'document', 'form', 'activity', 'compliance'];
const FREQUENCIES = ['once', 'monthly', 'quarterly', 'annually'];

export default function HierarchyRequirementsAdminPage() {
  const [requirements, setRequirements] = useState<HierarchyRequirement[]>([]);
  const [branchTypes, setBranchTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parentBranchType, setParentBranchType] = useState('');
  const [childBranchType, setChildBranchType] = useState('');
  const [kind, setKind] = useState('report');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [notifyRoleNames, setNotifyRoleNames] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<HierarchyRequirementSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, branchRes] = await Promise.all([
        hierarchyRequirementsApi.list(TENANT_SLUG),
        branchesApi.list(TENANT_SLUG, true),
      ]);
      if (reqRes.success && reqRes.data) setRequirements(reqRes.data);
      else setError(reqRes.error?.message ?? 'Could not load hierarchy requirements.');
      if (branchRes.success && branchRes.data) {
        setBranches(branchRes.data);
        setBranchTypes(Array.from(new Set(branchRes.data.map((b) => b.branchType).filter((t): t is string => !!t))));
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadSubmissions(requirementId: string) {
    setSubmissionsLoading(true);
    try {
      const res = await hierarchyRequirementsApi.submissionsForRequirement(TENANT_SLUG, requirementId);
      if (res.success && res.data) setSubmissions(res.data);
      else setError(res.error?.message ?? 'Could not load submissions.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setSubmissionsLoading(false);
    }
  }

  function selectRequirement(req: HierarchyRequirement) {
    setSelectedId(req.id);
    loadSubmissions(req.id);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!parentBranchType.trim() || !childBranchType.trim() || !label.trim()) return;
    try {
      const res = await hierarchyRequirementsApi.create(TENANT_SLUG, {
        parentBranchType: parentBranchType.trim(),
        childBranchType: childBranchType.trim(),
        kind,
        label: label.trim(),
        description: description.trim() || undefined,
        frequency,
        notifyRoleNames: notifyRoleNames
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean),
      });
      if (res.success) {
        setParentBranchType('');
        setChildBranchType('');
        setLabel('');
        setDescription('');
        setNotifyRoleNames('');
        load();
      } else {
        setError(res.error?.message ?? 'Could not create the requirement.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemove(id: string) {
    try {
      const res = await hierarchyRequirementsApi.remove(TENANT_SLUG, id);
      if (res.success) {
        if (selectedId === id) setSelectedId(null);
        load();
      } else {
        setError(res.error?.message ?? 'Could not remove the requirement.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleDecide(submissionId: string, decision: 'approve' | 'reject') {
    const reason = window.prompt(`Reason for this ${decision === 'approve' ? 'approval' : 'rejection'}:`);
    if (!reason || reason.trim().length < 3) {
      setError('A reason of at least 3 characters is required.');
      return;
    }
    try {
      const res =
        decision === 'approve'
          ? await hierarchyRequirementsApi.approve(TENANT_SLUG, submissionId, reason.trim())
          : await hierarchyRequirementsApi.reject(TENANT_SLUG, submissionId, reason.trim());
      if (res.success && selectedId) loadSubmissions(selectedId);
      else setError(res.error?.message ?? 'Could not record the decision.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function branchName(id: string) {
    return branches.find((b) => b.id === id)?.name ?? '—';
  }

  const selectedRequirement = requirements.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Church &amp; Hierarchy</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Requirements between levels</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Define what each organizational level requires of the level directly beneath it —
            reports, documents, forms, or mandatory activities — and track submissions across
            every branch that owes one.
          </p>
        </header>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="hr-parent" className="mb-1 text-slate-600">Parent level (e.g. diocese)</Label>
              <Input
                id="hr-parent"
                list="branch-types"
                value={parentBranchType}
                onChange={(e) => setParentBranchType(e.target.value)}
                placeholder="diocese"
              />
            </div>
            <div>
              <Label htmlFor="hr-child" className="mb-1 text-slate-600">Child level (e.g. district)</Label>
              <Input
                id="hr-child"
                list="branch-types"
                value={childBranchType}
                onChange={(e) => setChildBranchType(e.target.value)}
                placeholder="district"
              />
            </div>
            <datalist id="branch-types">
              {branchTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <div>
              <Label htmlFor="hr-kind" className="mb-1 text-slate-600">Kind</Label>
              <select
                id="hr-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="hr-label" className="mb-1 text-slate-600">Label</Label>
              <Input id="hr-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Monthly activity report" />
            </div>
            <div>
              <Label htmlFor="hr-frequency" className="mb-1 text-slate-600">Frequency</Label>
              <select
                id="hr-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="hr-notify" className="mb-1 text-slate-600">Notify roles (comma-separated, optional)</Label>
              <Input id="hr-notify" value={notifyRoleNames} onChange={(e) => setNotifyRoleNames(e.target.value)} placeholder="Bishop, Dean" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="hr-description" className="mb-1 text-slate-600">Description (optional)</Label>
              <Input id="hr-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this requirement cover?" />
            </div>
          </div>
          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>Add requirement</Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : requirements.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No requirements defined yet.</div>
            ) : (
              requirements.map((r) => (
                <div
                  key={r.id}
                  onClick={() => selectRequirement(r)}
                  className={`flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer ${
                    selectedId === r.id ? 'bg-[#1E2A44]/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.label}</p>
                    <p className="text-xs text-slate-400">
                      {r.parentBranchType} → {r.childBranchType} · {r.kind} · {r.frequency}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(r.id);
                    }}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {!selectedRequirement ? (
              <div className="py-8 text-center text-sm text-slate-400">Select a requirement to review submissions.</div>
            ) : (
              <>
                <h2 className="font-serif text-lg text-[#1E2A44] mb-1">{selectedRequirement.label}</h2>
                <p className="text-xs text-slate-400 mb-3">Submissions from every {selectedRequirement.childBranchType}</p>

                {submissionsLoading ? (
                  <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
                ) : submissions.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">No submissions yet.</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {submissions.map((s) => (
                      <div key={s.id} className="py-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{branchName(s.branchId)}</p>
                            <p className="text-xs text-slate-400">
                              {s.periodLabel || 'one-off'} ·{' '}
                              <span
                                className={
                                  s.status === 'approved'
                                    ? 'text-emerald-600'
                                    : s.status === 'rejected'
                                    ? 'text-red-600'
                                    : s.status === 'submitted'
                                    ? 'text-[#C9A24B]'
                                    : 'text-slate-400'
                                }
                              >
                                {s.status}
                              </span>
                            </p>
                          </div>
                          {s.status === 'submitted' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDecide(s.id, 'approve')}
                                className="text-xs font-medium px-3 py-1 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDecide(s.id, 'reject')}
                                className="text-xs font-medium px-3 py-1 rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
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
