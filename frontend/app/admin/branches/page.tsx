'use client';

// app/admin/branches/page.tsx
// Lets a Church Administrator manage the organizational hierarchy (dioceses,
// parishes, districts, cells, or a flat single-branch church — whatever
// shape this tenant needs) through the Church & Hierarchy Management module.

import { useEffect, useState } from 'react';
import {
  branchesApi,
  hierarchyRequirementsApi,
  hierarchyLevelsApi,
  configApi,
  Branch,
  BranchTreeNode,
  HierarchyRequirement,
  HierarchyRequirementSubmission,
  HierarchyLevelDefinition,
} from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const TENANT_SLUG = 'demo-church'; // in production this comes from the resolved workspace/domain

function flatten(nodes: BranchTreeNode[]): Branch[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

function BranchNode({
  node,
  depth,
  selectedId,
  onToggle,
  onSelect,
}: {
  node: BranchTreeNode;
  depth: number;
  selectedId: string | null;
  onToggle: (branch: Branch) => void;
  onSelect: (branch: Branch) => void;
}) {
  return (
    <div>
      <div
        className={`flex items-center justify-between py-2 pr-3 border-b border-slate-100 last:border-0 ${
          selectedId === node.id ? 'bg-[#1E2A44]/5' : ''
        }`}
        style={{ paddingLeft: 12 + depth * 20 }}
      >
        <button onClick={() => onSelect(node)} className="flex items-center gap-2 min-w-0 text-left">
          <span className={`text-sm font-medium truncate ${node.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
            {node.name}
          </span>
          {node.isHeadquarters && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide font-semibold text-[#C9A24B] border border-[#C9A24B]/40 rounded-full px-2 py-0.5">
              HQ
            </span>
          )}
          {node.branchType && <span className="shrink-0 text-xs text-slate-400">{node.branchType}</span>}
        </button>
        <button
          onClick={() => onToggle(node)}
          className="shrink-0 text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
        >
          {node.isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
      {node.children.map((child) => (
        <BranchNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onToggle={onToggle} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default function BranchesAdminPage() {
  const [tree, setTree] = useState<BranchTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [branchType, setBranchType] = useState('');
  const [parentBranchId, setParentBranchId] = useState('');

  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [owedRequirements, setOwedRequirements] = useState<HierarchyRequirement[]>([]);
  const [ownSubmissions, setOwnSubmissions] = useState<HierarchyRequirementSubmission[]>([]);
  const [requirementsLoading, setRequirementsLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await branchesApi.tree(TENANT_SLUG, true);
      if (res.success && res.data) {
        setTree(res.data);
      } else {
        setError(res.error?.message ?? 'Could not load the church hierarchy.');
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await branchesApi.create(TENANT_SLUG, {
        name: name.trim(),
        branchType: branchType.trim() || undefined,
        parentBranchId: parentBranchId || undefined,
      });
      if (res.success) {
        setName('');
        setBranchType('');
        setParentBranchId('');
        load();
      } else {
        setError(res.error?.message ?? 'Could not create the branch.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function loadRequirements(branch: Branch) {
    setRequirementsLoading(true);
    try {
      const [owedRes, subsRes] = await Promise.all([
        hierarchyRequirementsApi.forBranch(TENANT_SLUG, branch.id),
        hierarchyRequirementsApi.submissionsForBranch(TENANT_SLUG, branch.id),
      ]);
      if (owedRes.success && owedRes.data) setOwedRequirements(owedRes.data);
      if (subsRes.success && subsRes.data) setOwnSubmissions(subsRes.data);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setRequirementsLoading(false);
    }
  }

  function handleSelectBranch(branch: Branch) {
    setSelectedBranch(branch);
    loadRequirements(branch);
  }

  async function handleOpenCycle(requirementId: string) {
    if (!selectedBranch) return;
    const periodLabel = window.prompt('Period label for this cycle (e.g. 2026-07), or leave blank for a one-off:') ?? undefined;
    try {
      const res = await hierarchyRequirementsApi.createSubmission(TENANT_SLUG, requirementId, selectedBranch.id, {
        periodLabel: periodLabel || undefined,
      });
      if (res.success) loadRequirements(selectedBranch);
      else setError(res.error?.message ?? 'Could not open a submission cycle.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleMarkSubmitted(submissionId: string) {
    if (!selectedBranch) return;
    try {
      const res = await hierarchyRequirementsApi.submit(TENANT_SLUG, submissionId);
      if (res.success) loadRequirements(selectedBranch);
      else setError(res.error?.message ?? 'Could not mark this submitted.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleToggle(branch: Branch) {
    try {
      const res = branch.isActive
        ? await branchesApi.deactivate(TENANT_SLUG, branch.id)
        : await branchesApi.reactivate(TENANT_SLUG, branch.id);
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not update the branch.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  const flatBranches = flatten(tree);

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Church &amp; Hierarchy</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Organizational structure</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Model your church exactly as it actually operates — a single branch, or a full
            diocese → parish → district → cell hierarchy. Member Management and Finance will
            attach records to whatever you build here.
          </p>
        </header>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="branch-name" className="mb-1 text-slate-600">
                Name
              </Label>
              <Input
                id="branch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kigali Central Parish"
              />
            </div>
            <div>
              <Label htmlFor="branch-type" className="mb-1 text-slate-600">
                Type (optional)
              </Label>
              <Input
                id="branch-type"
                value={branchType}
                onChange={(e) => setBranchType(e.target.value)}
                placeholder="parish, district, cell…"
              />
            </div>
            <div>
              <Label htmlFor="branch-parent" className="mb-1 text-slate-600">
                Parent branch (optional)
              </Label>
              <select
                id="branch-parent"
                value={parentBranchId}
                onChange={(e) => setParentBranchId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Root level —</option>
                {flatBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>
            Add branch
          </Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : tree.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No branches yet. Add your first one above — it&rsquo;ll usually be your headquarters.
              </div>
            ) : (
              tree.map((node) => (
                <BranchNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedBranch?.id ?? null}
                  onToggle={handleToggle}
                  onSelect={handleSelectBranch}
                />
              ))
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {!selectedBranch ? (
              <div className="py-8 text-center text-sm text-slate-400">Select a branch to see what it owes upward.</div>
            ) : requirementsLoading ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : (
              <>
                <h2 className="font-serif text-lg text-[#1E2A44] mb-1">{selectedBranch.name}</h2>
                <p className="text-xs text-slate-400 mb-3">Requirements owed upward</p>
                {owedRequirements.length === 0 ? (
                  <p className="text-sm text-slate-400 mb-4">
                    {selectedBranch.branchType
                      ? 'No requirements are configured from this branch’s parent level.'
                      : 'This branch has no branch type set, so no requirements can be matched.'}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-50 mb-4">
                    {owedRequirements.map((r) => {
                      const existing = ownSubmissions.find((s) => s.requirementId === r.id && !s.periodLabel);
                      return (
                        <div key={r.id} className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{r.label}</p>
                            <p className="text-xs text-slate-400">{r.kind} · {r.frequency}</p>
                          </div>
                          <Button size="sm" style={{ backgroundColor: '#1E2A44' }} onClick={() => handleOpenCycle(r.id)}>
                            Open cycle
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-xs text-slate-400 mb-2">This branch&rsquo;s submissions</p>
                {ownSubmissions.length === 0 ? (
                  <p className="text-sm text-slate-400">No submissions yet.</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {ownSubmissions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm text-slate-700">{s.periodLabel || 'one-off'}</p>
                          <p className="text-xs text-slate-400">{s.status}</p>
                        </div>
                        {s.status === 'pending' && (
                          <button
                            onClick={() => handleMarkSubmitted(s.id)}
                            className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                          >
                            Mark submitted
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <HierarchyRulesSection />
      </div>
    </div>
  );
}

interface BranchTypeOption {
  key: string;
  label: string;
}

function HierarchyRulesSection() {
  const [branchTypes, setBranchTypes] = useState<BranchTypeOption[]>([]);
  const [rules, setRules] = useState<HierarchyLevelDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [branchTypeKey, setBranchTypeKey] = useState('');
  const [label, setLabel] = useState('');
  const [allowedParentTypeKeys, setAllowedParentTypeKeys] = useState<string[]>([]);
  const [allowedChildTypeKeys, setAllowedChildTypeKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const [typesRes, rulesRes] = await Promise.all([
      configApi.listByNamespace(TENANT_SLUG, 'branch_type'),
      hierarchyLevelsApi.list(TENANT_SLUG),
    ]);
    if (typesRes.success && typesRes.data) {
      setBranchTypes(typesRes.data.map((t: { key: string; label: string }) => ({ key: t.key, label: t.label })));
    }
    if (rulesRes.success && rulesRes.data) setRules(rulesRes.data);
    else setError(rulesRes.error?.message ?? 'Could not load hierarchy rules.');
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function toggleKey(list: string[], setList: (v: string[]) => void, key: string) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!branchTypeKey || !label.trim()) return;
    setSaving(true);
    setError(null);
    const res = await hierarchyLevelsApi.create(TENANT_SLUG, {
      branchTypeKey,
      label: label.trim(),
      allowedParentTypeKeys,
      allowedChildTypeKeys,
    });
    if (res.success) {
      setBranchTypeKey('');
      setLabel('');
      setAllowedParentTypeKeys([]);
      setAllowedChildTypeKeys([]);
      load();
    } else {
      setError(res.error?.message ?? 'Could not create the rule.');
    }
    setSaving(false);
  }

  async function handleDelete(rule: HierarchyLevelDefinition) {
    if (!confirm(`Remove the nesting rule for "${rule.label}"? That branch type goes back to unconstrained nesting.`)) return;
    const res = await hierarchyLevelsApi.remove(TENANT_SLUG, rule.id);
    if (res.success) load();
    else setError(res.error?.message ?? 'Could not remove the rule.');
  }

  function typeLabel(key: string): string {
    return branchTypes.find((t) => t.key === key)?.label ?? key;
  }

  return (
    <div className="mt-10">
      <header className="mb-4">
        <h2 className="font-serif text-xl text-[#1E2A44]">Hierarchy level rules</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-xl">
          Optional — constrain which branch types can nest under which. A type with no rule here stays
          unconstrained, exactly as before. Types come from{' '}
          <span className="font-medium">Configuration &rarr; Lookup Values &rarr; Branch Types</span>.
        </p>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

      <div className="grid md:grid-cols-[1fr_1.3fr] gap-6">
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 h-fit space-y-3">
          {branchTypes.length === 0 ? (
            <p className="text-sm text-slate-400">
              No branch types defined yet — add some under Configuration &rarr; Lookup Values &rarr; Branch Types first.
            </p>
          ) : (
            <>
              <div>
                <Label className="mb-1 text-slate-600">Branch type</Label>
                <select
                  value={branchTypeKey}
                  onChange={(e) => {
                    setBranchTypeKey(e.target.value);
                    if (!label) setLabel(typeLabel(e.target.value));
                  }}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                >
                  <option value="">— Select —</option>
                  {branchTypes.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="rule-label" className="mb-1 text-slate-600">
                  Label
                </Label>
                <Input id="rule-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. District" />
              </div>
              <div>
                <Label className="mb-1 text-slate-600">Allowed parent types (empty = any)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {branchTypes.filter((t) => t.key !== branchTypeKey).map((t) => (
                    <button
                      type="button"
                      key={t.key}
                      onClick={() => toggleKey(allowedParentTypeKeys, setAllowedParentTypeKeys, t.key)}
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        allowedParentTypeKeys.includes(t.key)
                          ? 'bg-[#1E2A44] text-white border-[#1E2A44]'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1 text-slate-600">Allowed child types (empty = any)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {branchTypes.filter((t) => t.key !== branchTypeKey).map((t) => (
                    <button
                      type="button"
                      key={t.key}
                      onClick={() => toggleKey(allowedChildTypeKeys, setAllowedChildTypeKeys, t.key)}
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        allowedChildTypeKeys.includes(t.key)
                          ? 'bg-[#1E2A44] text-white border-[#1E2A44]'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={saving} style={{ backgroundColor: '#1E2A44' }}>
                {saving ? 'Saving…' : 'Add rule'}
              </Button>
            </>
          )}
        </form>

        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden h-fit">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : rules.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No rules defined — every branch type nests freely.</div>
          ) : (
            rules.map((r) => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800">{r.label}</p>
                  <button onClick={() => handleDelete(r)} className="text-xs text-red-500 hover:underline">
                    Remove
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Parents: {r.allowedParentTypeKeys.length ? r.allowedParentTypeKeys.map(typeLabel).join(', ') : 'any'}
                </p>
                <p className="text-xs text-slate-400">
                  Children: {r.allowedChildTypeKeys.length ? r.allowedChildTypeKeys.map(typeLabel).join(', ') : 'any'}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
