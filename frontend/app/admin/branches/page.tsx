'use client';

// app/admin/branches/page.tsx
// Lets a Church Administrator manage the organizational hierarchy (dioceses,
// parishes, districts, cells, or a flat single-branch church — whatever
// shape this tenant needs) through the Church & Hierarchy Management module.

import { useEffect, useState } from 'react';
import { branchesApi, Branch, BranchTreeNode } from '../../../lib/api';
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
  onToggle,
}: {
  node: BranchTreeNode;
  depth: number;
  onToggle: (branch: Branch) => void;
}) {
  return (
    <div>
      <div
        className="flex items-center justify-between py-2 pr-3 border-b border-slate-100 last:border-0"
        style={{ paddingLeft: 12 + depth * 20 }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm font-medium truncate ${node.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
            {node.name}
          </span>
          {node.isHeadquarters && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide font-semibold text-[#C9A24B] border border-[#C9A24B]/40 rounded-full px-2 py-0.5">
              HQ
            </span>
          )}
          {node.branchType && <span className="shrink-0 text-xs text-slate-400">{node.branchType}</span>}
        </div>
        <button
          onClick={() => onToggle(node)}
          className="shrink-0 text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
        >
          {node.isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
      {node.children.map((child) => (
        <BranchNode key={child.id} node={child} depth={depth + 1} onToggle={onToggle} />
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

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : tree.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No branches yet. Add your first one above — it&rsquo;ll usually be your headquarters.
            </div>
          ) : (
            tree.map((node) => <BranchNode key={node.id} node={node} depth={0} onToggle={handleToggle} />)
          )}
        </div>
      </div>
    </div>
  );
}
