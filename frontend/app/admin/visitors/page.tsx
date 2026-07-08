'use client';

// app/admin/visitors/page.tsx
// Lets a Church Administrator / Follow-up Coordinator record first-time
// visitors, assign them for follow-up, log each outreach interaction, and
// (once they've joined) link them to the Member record they became.

import { useEffect, useState } from 'react';
import {
  visitorsApi,
  branchesApi,
  membersApi,
  usersApi,
  configApi,
  Visitor,
  VisitorFollowUp,
  Branch,
  Member,
  AppUser,
} from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const TENANT_SLUG = 'demo-church';

const STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'scheduled_visit', label: 'Scheduled visit' },
  { value: 'joined', label: 'Joined' },
  { value: 'no_response', label: 'No response' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_STYLES: Record<string, string> = {
  new: 'text-slate-500 bg-slate-100 border-slate-200',
  contacted: 'text-amber-700 bg-amber-50 border-amber-200',
  scheduled_visit: 'text-blue-700 bg-blue-50 border-blue-200',
  joined: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  no_response: 'text-red-700 bg-red-50 border-red-200',
  closed: 'text-slate-400 bg-slate-50 border-slate-200 line-through',
};

export default function VisitorsAdminPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [sources, setSources] = useState<{ key: string; label: string }[]>([]);
  const [methods, setMethods] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('');
  const [invitedByMemberId, setInvitedByMemberId] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');

  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<VisitorFollowUp[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [followUpMethod, setFollowUpMethod] = useState('');
  const [followUpOutcome, setFollowUpOutcome] = useState('');
  const [convertMemberId, setConvertMemberId] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [visitorsRes, branchesRes, membersRes, usersRes, sourcesRes, methodsRes] = await Promise.all([
        visitorsApi.list(TENANT_SLUG, { status: statusFilter || undefined, search: search || undefined }),
        branchesApi.list(TENANT_SLUG),
        membersApi.list(TENANT_SLUG, {}),
        usersApi.list(TENANT_SLUG),
        configApi.listByNamespace(TENANT_SLUG, 'visitor_source'),
        configApi.listByNamespace(TENANT_SLUG, 'follow_up_method'),
      ]);
      if (visitorsRes.success && visitorsRes.data) setVisitors(visitorsRes.data);
      else setError(visitorsRes.error?.message ?? 'Could not load visitors.');
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
      if (membersRes.success && membersRes.data) setMembers(membersRes.data);
      if (usersRes.success && usersRes.data) setUsers(usersRes.data);
      if (sourcesRes.success && sourcesRes.data) setSources(sourcesRes.data as { key: string; label: string }[]);
      if (methodsRes.success && methodsRes.data) setMethods(methodsRes.data as { key: string; label: string }[]);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search]);

  async function loadFollowUps(visitorId: string) {
    setFollowUpsLoading(true);
    try {
      const res = await visitorsApi.listFollowUps(TENANT_SLUG, visitorId);
      if (res.success && res.data) setFollowUps(res.data);
      else setError(res.error?.message ?? 'Could not load follow-up history.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setFollowUpsLoading(false);
    }
  }

  function selectVisitor(v: Visitor) {
    setSelectedVisitorId(v.id);
    setConvertMemberId('');
    loadFollowUps(v.id);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !visitDate) {
      setError('First name, last name, and visit date are required.');
      return;
    }
    try {
      const res = await visitorsApi.create(TENANT_SLUG, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        branchId: branchId || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        visitDate,
        source: source || undefined,
        invitedByMemberId: invitedByMemberId || undefined,
        assignedToUserId: assignedToUserId || undefined,
      });
      if (res.success) {
        setFirstName('');
        setLastName('');
        setBranchId('');
        setPhone('');
        setEmail('');
        setSource('');
        setInvitedByMemberId('');
        setAssignedToUserId('');
        load();
      } else {
        setError(res.error?.message ?? 'Could not record the visitor.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemove(id: string) {
    try {
      const res = await visitorsApi.remove(TENANT_SLUG, id);
      if (res.success) {
        if (selectedVisitorId === id) setSelectedVisitorId(null);
        load();
      } else {
        setError(res.error?.message ?? 'Could not remove the visitor.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      const res = await visitorsApi.update(TENANT_SLUG, id, { status });
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not update the status.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleAddFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisitorId || !followUpMethod) return;
    try {
      const res = await visitorsApi.addFollowUp(TENANT_SLUG, selectedVisitorId, {
        method: followUpMethod,
        outcome: followUpOutcome.trim() || undefined,
      });
      if (res.success) {
        setFollowUpMethod('');
        setFollowUpOutcome('');
        loadFollowUps(selectedVisitorId);
      } else {
        setError(res.error?.message ?? 'Could not log the follow-up.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleConvert() {
    if (!selectedVisitorId || !convertMemberId) return;
    try {
      const res = await visitorsApi.convert(TENANT_SLUG, selectedVisitorId, convertMemberId);
      if (res.success) {
        setConvertMemberId('');
        load();
      } else {
        setError(res.error?.message ?? 'Could not convert this visitor.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function memberName(id: string | null) {
    if (!id) return '—';
    const m = members.find((mm) => mm.id === id);
    return m ? `${m.firstName} ${m.lastName}` : '—';
  }

  function userName(id: string | null) {
    if (!id) return 'Unassigned';
    const u = users.find((uu) => uu.id === id);
    return u ? `${u.firstName} ${u.lastName}` : 'Unassigned';
  }

  const selectedVisitor = visitors.find((v) => v.id === selectedVisitorId) ?? null;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Visitor &amp; Follow-up Management</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Visitors</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Track first-time visitors from their first visit through follow-up to becoming a
            member — assign someone to reach out, log every call or visit, and link them to
            their member record once they join.
          </p>
        </header>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="vis-first" className="mb-1 text-slate-600">First name</Label>
              <Input id="vis-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Alice" />
            </div>
            <div>
              <Label htmlFor="vis-last" className="mb-1 text-slate-600">Last name</Label>
              <Input id="vis-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Uwase" />
            </div>
            <div>
              <Label htmlFor="vis-branch" className="mb-1 text-slate-600">Branch (optional)</Label>
              <select
                id="vis-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Unspecified —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="vis-phone" className="mb-1 text-slate-600">Phone (optional)</Label>
              <Input id="vis-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+250780000002" />
            </div>
            <div>
              <Label htmlFor="vis-email" className="mb-1 text-slate-600">Email (optional)</Label>
              <Input id="vis-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="vis-date" className="mb-1 text-slate-600">Visit date</Label>
              <Input id="vis-date" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="vis-source" className="mb-1 text-slate-600">How they heard (optional)</Label>
              <select
                id="vis-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Unspecified —</option>
                {sources.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="vis-invited-by" className="mb-1 text-slate-600">Invited by (optional)</Label>
              <select
                id="vis-invited-by"
                value={invitedByMemberId}
                onChange={(e) => setInvitedByMemberId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— None —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="vis-assigned" className="mb-1 text-slate-600">Assign follow-up to (optional)</Label>
              <select
                id="vis-assigned"
                value={assignedToUserId}
                onChange={(e) => setAssignedToUserId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Unassigned —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>Record visitor</Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email…" className="w-56" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : visitors.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No visitors yet. Record your first one above.</div>
            ) : (
              visitors.map((v) => (
                <div
                  key={v.id}
                  onClick={() => selectVisitor(v)}
                  className={`flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer ${
                    selectedVisitorId === v.id ? 'bg-[#1E2A44]/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{v.firstName} {v.lastName}</p>
                    <p className="text-xs text-slate-400">
                      Visited {v.visitDate.slice(0, 10)} · {userName(v.assignedToUserId)}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[v.status]}`}>
                    {STATUSES.find((s) => s.value === v.status)?.label ?? v.status}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {!selectedVisitor ? (
              <div className="py-8 text-center text-sm text-slate-400">Select a visitor to manage follow-up.</div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-serif text-lg text-[#1E2A44]">{selectedVisitor.firstName} {selectedVisitor.lastName}</h2>
                    <p className="text-xs text-slate-400">
                      {selectedVisitor.phone ?? selectedVisitor.email ?? 'No contact info'}
                      {selectedVisitor.invitedByMemberId ? ` · invited by ${memberName(selectedVisitor.invitedByMemberId)}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(selectedVisitor.id)}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>

                <div className="mb-4">
                  <Label className="mb-1 text-slate-600">Status</Label>
                  {selectedVisitor.status === 'joined' ? (
                    <p className="text-sm text-emerald-700">
                      Joined as {memberName(selectedVisitor.convertedMemberId)}
                    </p>
                  ) : (
                    <select
                      value={selectedVisitor.status}
                      onChange={(e) => handleStatusChange(selectedVisitor.id, e.target.value)}
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                    >
                      {STATUSES.filter((s) => s.value !== 'joined').map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedVisitor.status !== 'joined' && (
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <Label className="mb-1 text-slate-600">Convert to member</Label>
                    <div className="flex gap-2">
                      <select
                        value={convertMemberId}
                        onChange={(e) => setConvertMemberId(e.target.value)}
                        className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                      >
                        <option value="">— Select an existing member —</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                        ))}
                      </select>
                      <Button type="button" size="sm" onClick={handleConvert} disabled={!convertMemberId} style={{ backgroundColor: '#1E2A44' }}>
                        Convert
                      </Button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Create the member first (Members page) if they don&rsquo;t have a record yet.</p>
                  </div>
                )}

                <form onSubmit={handleAddFollowUp} className="space-y-2 mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={followUpMethod}
                      onChange={(e) => setFollowUpMethod(e.target.value)}
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                    >
                      <option value="">— Method —</option>
                      {methods.map((m) => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </select>
                    <Input value={followUpOutcome} onChange={(e) => setFollowUpOutcome(e.target.value)} placeholder="Outcome (optional)" />
                  </div>
                  <Button type="submit" size="sm" disabled={!followUpMethod} style={{ backgroundColor: '#1E2A44' }}>Log follow-up</Button>
                </form>

                {followUpsLoading ? (
                  <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
                ) : followUps.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">No follow-ups logged yet.</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {followUps.map((f) => (
                      <div key={f.id} className="py-2">
                        <p className="text-sm font-medium text-slate-800">
                          {methods.find((m) => m.key === f.method)?.label ?? f.method}
                        </p>
                        <p className="text-xs text-slate-400">{f.followUpDate.slice(0, 10)}</p>
                        {f.outcome && <p className="text-xs text-slate-600 mt-1">{f.outcome}</p>}
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
