'use client';

// app/admin/ministries/page.tsx
// Lets a Church Administrator create ministries (Youth, Choir, Ushering, ...)
// and manage their volunteer rosters — who's involved, and in what role.

import { useEffect, useState } from 'react';
import {
  ministriesApi,
  ministryMembershipsApi,
  branchesApi,
  membersApi,
  configApi,
  Ministry,
  MinistryMembership,
  Branch,
  Member,
} from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const TENANT_SLUG = 'demo-church'; // in production this comes from the resolved workspace/domain
const ROLES = ['leader', 'volunteer', 'member'];

export default function MinistriesAdminPage() {
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ministryTypes, setMinistryTypes] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [ministryType, setMinistryType] = useState('');
  const [branchId, setBranchId] = useState('');

  const [selectedMinistryId, setSelectedMinistryId] = useState<string | null>(null);
  const [roster, setRoster] = useState<MinistryMembership[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [newVolunteerId, setNewVolunteerId] = useState('');
  const [newVolunteerRole, setNewVolunteerRole] = useState('member');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [ministriesRes, branchesRes, membersRes, typesRes] = await Promise.all([
        ministriesApi.list(TENANT_SLUG),
        branchesApi.list(TENANT_SLUG),
        membersApi.list(TENANT_SLUG, {}),
        configApi.listByNamespace(TENANT_SLUG, 'ministry_type'),
      ]);
      if (ministriesRes.success && ministriesRes.data) setMinistries(ministriesRes.data);
      else setError(ministriesRes.error?.message ?? 'Could not load ministries.');
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
      if (membersRes.success && membersRes.data) setMembers(membersRes.data);
      if (typesRes.success && typesRes.data) setMinistryTypes(typesRes.data as { key: string; label: string }[]);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadRoster(ministryId: string) {
    setRosterLoading(true);
    try {
      const res = await ministryMembershipsApi.list(TENANT_SLUG, { ministryId });
      if (res.success && res.data) setRoster(res.data);
      else setError(res.error?.message ?? 'Could not load the roster.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setRosterLoading(false);
    }
  }

  function selectMinistry(ministry: Ministry) {
    setSelectedMinistryId(ministry.id);
    loadRoster(ministry.id);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await ministriesApi.create(TENANT_SLUG, {
        name: name.trim(),
        ministryType: ministryType || undefined,
        branchId: branchId || undefined,
      });
      if (res.success) {
        setName('');
        setMinistryType('');
        setBranchId('');
        load();
      } else {
        setError(res.error?.message ?? 'Could not create the ministry.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemoveMinistry(id: string) {
    try {
      const res = await ministriesApi.remove(TENANT_SLUG, id);
      if (res.success) {
        if (selectedMinistryId === id) setSelectedMinistryId(null);
        load();
      } else {
        setError(res.error?.message ?? 'Could not remove the ministry.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleAddVolunteer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMinistryId || !newVolunteerId) return;
    try {
      const res = await ministryMembershipsApi.create(TENANT_SLUG, {
        ministryId: selectedMinistryId,
        memberId: newVolunteerId,
        role: newVolunteerRole,
      });
      if (res.success) {
        setNewVolunteerId('');
        loadRoster(selectedMinistryId);
      } else {
        setError(res.error?.message ?? 'Could not add the volunteer.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemoveVolunteer(id: string) {
    if (!selectedMinistryId) return;
    try {
      const res = await ministryMembershipsApi.remove(TENANT_SLUG, id);
      if (res.success) loadRoster(selectedMinistryId);
      else setError(res.error?.message ?? 'Could not remove the volunteer.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function branchName(id: string | null) {
    if (!id) return 'Church-wide';
    return branches.find((b) => b.id === id)?.name ?? '—';
  }

  function memberName(id: string) {
    const m = members.find((mm) => mm.id === id);
    return m ? `${m.firstName} ${m.lastName}` : '—';
  }

  const selectedMinistry = ministries.find((m) => m.id === selectedMinistryId) ?? null;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Ministry &amp; Volunteers</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Ministries</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Create the ministries your church actually runs, then build each one&rsquo;s volunteer
            roster — who leads, who serves, and who belongs.
          </p>
        </header>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="min-name" className="mb-1 text-slate-600">
                Name
              </Label>
              <Input id="min-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Youth Ministry" />
            </div>
            <div>
              <Label htmlFor="min-type" className="mb-1 text-slate-600">
                Type (optional)
              </Label>
              <select
                id="min-type"
                value={ministryType}
                onChange={(e) => setMinistryType(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Unspecified —</option>
                {ministryTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="min-branch" className="mb-1 text-slate-600">
                Branch (optional)
              </Label>
              <select
                id="min-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Church-wide —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>
            Create ministry
          </Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : ministries.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No ministries yet. Create your first one above.
              </div>
            ) : (
              ministries.map((m) => (
                <div
                  key={m.id}
                  onClick={() => selectMinistry(m)}
                  className={`flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer ${
                    selectedMinistryId === m.id ? 'bg-[#1E2A44]/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{m.name}</p>
                    <p className="text-xs text-slate-400">
                      {branchName(m.branchId)}
                      {m.ministryType ? ` · ${m.ministryType.replace(/_/g, ' ')}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMinistry(m.id);
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
            {!selectedMinistry ? (
              <div className="py-8 text-center text-sm text-slate-400">Select a ministry to manage its roster.</div>
            ) : (
              <>
                <h2 className="font-serif text-lg text-[#1E2A44] mb-3">{selectedMinistry.name} roster</h2>
                <form onSubmit={handleAddVolunteer} className="flex gap-2 mb-4">
                  <select
                    value={newVolunteerId}
                    onChange={(e) => setNewVolunteerId(e.target.value)}
                    className="flex-1 h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                  >
                    <option value="">— Select a member —</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newVolunteerRole}
                    onChange={(e) => setNewVolunteerRole(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" style={{ backgroundColor: '#1E2A44' }}>
                    Add
                  </Button>
                </form>

                {rosterLoading ? (
                  <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
                ) : roster.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">No volunteers yet.</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {roster.map((r) => (
                      <div key={r.id} className="flex items-center justify-between py-2">
                        <div>
                          <p className={`text-sm font-medium ${r.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                            {memberName(r.memberId)}
                          </p>
                          <p className="text-xs text-slate-400">{r.role}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveVolunteer(r.id)}
                          className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                        >
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
