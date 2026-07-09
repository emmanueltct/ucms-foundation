'use client';

// app/admin/visitors/page.tsx
// Lets a Church Administrator / Follow-up Coordinator record first-time
// visitors (individually or as part of a group — a family, delegation,
// choir visit, conference party, mission team, ...), assign them for
// follow-up, log configurable activities (First Visit, Counseling, Prayer,
// Follow-up, Baptism Class, ...) against either, and (once they've joined)
// link an individual to the Member record they became. Activity types and
// their extra fields are entirely tenant-defined — see
// docs/visitor-management/business-analysis.md.

import { useEffect, useState } from 'react';
import {
  visitorsApi,
  visitorGroupsApi,
  branchesApi,
  membersApi,
  usersApi,
  configApi,
  customFieldDefinitionsApi,
  Visitor,
  VisitorGroup,
  VisitorActivity,
  Branch,
  Member,
  AppUser,
  CustomFieldDefinition,
} from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { DynamicCustomFields } from '../../../components/dynamic-custom-fields';

const TENANT_SLUG = 'demo-church';

const STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'scheduled_visit', label: 'Scheduled visit' },
  { value: 'joined', label: 'Joined' },
  { value: 'no_response', label: 'No response' },
  { value: 'closed', label: 'Closed' },
];

const GROUP_STATUSES = STATUSES.filter((s) => s.value !== 'joined');

const STATUS_STYLES: Record<string, string> = {
  new: 'text-slate-500 bg-slate-100 border-slate-200',
  contacted: 'text-amber-700 bg-amber-50 border-amber-200',
  scheduled_visit: 'text-blue-700 bg-blue-50 border-blue-200',
  joined: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  no_response: 'text-red-700 bg-red-50 border-red-200',
  closed: 'text-slate-400 bg-slate-50 border-slate-200 line-through',
};

/** Shared by both the individual-visitor and visitor-group detail panels — activity logging is identical for either target. */
function ActivityPanel({
  activityTypes,
  activities,
  activitiesLoading,
  onAdd,
}: {
  activityTypes: { key: string; label: string }[];
  activities: VisitorActivity[];
  activitiesLoading: boolean;
  onAdd: (activityType: string, outcome: string, notes: string, customFields: Record<string, unknown>) => Promise<void>;
}) {
  const [activityType, setActivityType] = useState('');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activityType) {
      setCustomFieldDefs([]);
      return;
    }
    customFieldDefinitionsApi.list(TENANT_SLUG, { entityType: `visitor_activity:${activityType}` }).then((res) => {
      if (res.success && res.data) setCustomFieldDefs(res.data);
    });
    setCustomFieldValues({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activityType) return;
    setSubmitting(true);
    try {
      await onAdd(activityType, outcome.trim(), notes.trim(), customFieldValues);
      setActivityType('');
      setOutcome('');
      setNotes('');
      setCustomFieldValues({});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-2 mb-4">
        <select
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
        >
          <option value="">— Activity type —</option>
          {activityTypes.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Outcome (optional)" />
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
        {customFieldDefs.length > 0 && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
            <DynamicCustomFields
              definitions={customFieldDefs}
              values={customFieldValues}
              onChange={(key, value) => setCustomFieldValues((prev) => ({ ...prev, [key]: value }))}
            />
          </div>
        )}
        <Button type="submit" size="sm" disabled={!activityType || submitting} style={{ backgroundColor: '#1E2A44' }}>
          Log activity
        </Button>
      </form>

      {activitiesLoading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
      ) : activities.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">No activities logged yet.</div>
      ) : (
        <div className="divide-y divide-slate-50">
          {activities.map((a) => (
            <div key={a.id} className="py-2">
              <p className="text-sm font-medium text-slate-800">
                {activityTypes.find((t) => t.key === a.activityType)?.label ?? a.activityType}
              </p>
              <p className="text-xs text-slate-400">{a.activityDate.slice(0, 10)}</p>
              {a.outcome && <p className="text-xs text-slate-600 mt-1">{a.outcome}</p>}
              {a.notes && <p className="text-xs text-slate-500 mt-0.5">{a.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VisitorsAdminPage() {
  const [tab, setTab] = useState<'individuals' | 'groups'>('individuals');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [sources, setSources] = useState<{ key: string; label: string }[]>([]);
  const [groupTypes, setGroupTypes] = useState<{ key: string; label: string }[]>([]);
  const [activityTypes, setActivityTypes] = useState<{ key: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ---- Individuals ----
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [visitorsLoading, setVisitorsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [visitorGroupId, setVisitorGroupId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('');
  const [invitedByMemberId, setInvitedByMemberId] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');

  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);
  const [visitorActivities, setVisitorActivities] = useState<VisitorActivity[]>([]);
  const [visitorActivitiesLoading, setVisitorActivitiesLoading] = useState(false);
  const [convertMemberId, setConvertMemberId] = useState('');

  // ---- Groups ----
  const [groups, setGroups] = useState<VisitorGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('');
  const [groupVisitDate, setGroupVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [groupContactName, setGroupContactName] = useState('');
  const [groupContactPhone, setGroupContactPhone] = useState('');
  const [groupExpectedSize, setGroupExpectedSize] = useState('');

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<Visitor[]>([]);
  const [groupActivities, setGroupActivities] = useState<VisitorActivity[]>([]);
  const [groupActivitiesLoading, setGroupActivitiesLoading] = useState(false);

  async function loadReference() {
    const [branchesRes, membersRes, usersRes, sourcesRes, groupTypesRes, activityTypesRes] = await Promise.all([
      branchesApi.list(TENANT_SLUG),
      membersApi.list(TENANT_SLUG, {}),
      usersApi.list(TENANT_SLUG),
      configApi.listByNamespace(TENANT_SLUG, 'visitor_source'),
      configApi.listByNamespace(TENANT_SLUG, 'visitor_group_type'),
      configApi.listByNamespace(TENANT_SLUG, 'visitor_activity_type'),
    ]);
    if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
    if (membersRes.success && membersRes.data) setMembers(membersRes.data);
    if (usersRes.success && usersRes.data) setUsers(usersRes.data);
    if (sourcesRes.success && sourcesRes.data) setSources(sourcesRes.data as { key: string; label: string }[]);
    if (groupTypesRes.success && groupTypesRes.data) setGroupTypes(groupTypesRes.data as { key: string; label: string }[]);
    if (activityTypesRes.success && activityTypesRes.data) setActivityTypes(activityTypesRes.data as { key: string; label: string }[]);
  }

  async function loadVisitors() {
    setVisitorsLoading(true);
    try {
      const res = await visitorsApi.list(TENANT_SLUG, { status: statusFilter || undefined, search: search || undefined });
      if (res.success && res.data) setVisitors(res.data);
      else setError(res.error?.message ?? 'Could not load visitors.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setVisitorsLoading(false);
    }
  }

  async function loadGroups() {
    setGroupsLoading(true);
    try {
      const res = await visitorGroupsApi.list(TENANT_SLUG, {});
      if (res.success && res.data) setGroups(res.data);
      else setError(res.error?.message ?? 'Could not load visitor groups.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setGroupsLoading(false);
    }
  }

  useEffect(() => {
    loadReference();
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadVisitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search]);

  async function loadVisitorActivities(visitorId: string) {
    setVisitorActivitiesLoading(true);
    try {
      const res = await visitorsApi.listActivities(TENANT_SLUG, visitorId);
      if (res.success && res.data) setVisitorActivities(res.data);
      else setError(res.error?.message ?? 'Could not load activity history.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setVisitorActivitiesLoading(false);
    }
  }

  async function loadGroupDetail(id: string) {
    setGroupActivitiesLoading(true);
    try {
      const [membersRes, activitiesRes] = await Promise.all([
        visitorGroupsApi.listMembers(TENANT_SLUG, id),
        visitorGroupsApi.listActivities(TENANT_SLUG, id),
      ]);
      if (membersRes.success && membersRes.data) setGroupMembers(membersRes.data);
      if (activitiesRes.success && activitiesRes.data) setGroupActivities(activitiesRes.data);
      else if (!activitiesRes.success) setError(activitiesRes.error?.message ?? 'Could not load group activity history.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setGroupActivitiesLoading(false);
    }
  }

  function selectVisitor(v: Visitor) {
    setSelectedVisitorId(v.id);
    setConvertMemberId('');
    loadVisitorActivities(v.id);
  }

  function selectGroup(g: VisitorGroup) {
    setSelectedGroupId(g.id);
    loadGroupDetail(g.id);
  }

  async function handleCreateVisitor(e: React.FormEvent) {
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
        visitorGroupId: visitorGroupId || undefined,
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
        setVisitorGroupId('');
        setPhone('');
        setEmail('');
        setSource('');
        setInvitedByMemberId('');
        setAssignedToUserId('');
        loadVisitors();
      } else {
        setError(res.error?.message ?? 'Could not record the visitor.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemoveVisitor(id: string) {
    try {
      const res = await visitorsApi.remove(TENANT_SLUG, id);
      if (res.success) {
        if (selectedVisitorId === id) setSelectedVisitorId(null);
        loadVisitors();
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
      if (res.success) loadVisitors();
      else setError(res.error?.message ?? 'Could not update the status.');
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
        loadVisitors();
      } else {
        setError(res.error?.message ?? 'Could not convert this visitor.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim() || !groupType || !groupVisitDate) {
      setError('Name, group type, and visit date are required.');
      return;
    }
    try {
      const res = await visitorGroupsApi.create(TENANT_SLUG, {
        name: groupName.trim(),
        groupType,
        visitDate: groupVisitDate,
        contactName: groupContactName.trim() || undefined,
        contactPhone: groupContactPhone.trim() || undefined,
        expectedSize: groupExpectedSize ? Number(groupExpectedSize) : undefined,
      });
      if (res.success) {
        setGroupName('');
        setGroupType('');
        setGroupContactName('');
        setGroupContactPhone('');
        setGroupExpectedSize('');
        loadGroups();
      } else {
        setError(res.error?.message ?? 'Could not record the group.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemoveGroup(id: string) {
    try {
      const res = await visitorGroupsApi.remove(TENANT_SLUG, id);
      if (res.success) {
        if (selectedGroupId === id) setSelectedGroupId(null);
        loadGroups();
      } else {
        setError(res.error?.message ?? 'Could not remove the group.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleGroupStatusChange(id: string, status: string) {
    try {
      const res = await visitorGroupsApi.update(TENANT_SLUG, id, { status });
      if (res.success) loadGroups();
      else setError(res.error?.message ?? 'Could not update the status.');
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
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Visitor &amp; Follow-up Management</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Visitors</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Track individual visitors and whole visiting groups — delegations, families, choir or
            youth visits, conference parties, mission teams — from first contact through
            configurable follow-up activities to (for individuals) becoming a member.
          </p>
        </header>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('individuals')}
            className={`text-sm font-medium px-4 py-1.5 rounded-full border ${
              tab === 'individuals' ? 'bg-[#1E2A44] text-white border-[#1E2A44]' : 'border-slate-200 text-slate-600'
            }`}
          >
            Individuals
          </button>
          <button
            onClick={() => setTab('groups')}
            className={`text-sm font-medium px-4 py-1.5 rounded-full border ${
              tab === 'groups' ? 'bg-[#1E2A44] text-white border-[#1E2A44]' : 'border-slate-200 text-slate-600'
            }`}
          >
            Groups
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        {tab === 'individuals' ? (
          <>
            <form onSubmit={handleCreateVisitor} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
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
                  <Label htmlFor="vis-group" className="mb-1 text-slate-600">Arrived with group (optional)</Label>
                  <select
                    id="vis-group"
                    value={visitorGroupId}
                    onChange={(e) => setVisitorGroupId(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                  >
                    <option value="">— None (arrived alone) —</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
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
                {visitorsLoading ? (
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
                          {v.visitorGroupId ? ` · ${groups.find((g) => g.id === v.visitorGroupId)?.name ?? 'group'}` : ''}
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
                        onClick={() => handleRemoveVisitor(selectedVisitor.id)}
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

                    <ActivityPanel
                      activityTypes={activityTypes}
                      activities={visitorActivities}
                      activitiesLoading={visitorActivitiesLoading}
                      onAdd={async (activityType, outcome, notes, customFields) => {
                        const res = await visitorsApi.addActivity(TENANT_SLUG, selectedVisitor.id, {
                          activityType,
                          outcome: outcome || undefined,
                          notes: notes || undefined,
                          customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
                        });
                        if (res.success) loadVisitorActivities(selectedVisitor.id);
                        else setError(res.error?.message ?? 'Could not log the activity.');
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleCreateGroup} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="grp-name" className="mb-1 text-slate-600">Group name</Label>
                  <Input id="grp-name" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Kigali Baptist Youth Choir" />
                </div>
                <div>
                  <Label htmlFor="grp-type" className="mb-1 text-slate-600">Group type</Label>
                  <select
                    id="grp-type"
                    value={groupType}
                    onChange={(e) => setGroupType(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                  >
                    <option value="">— Select —</option>
                    {groupTypes.map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="grp-date" className="mb-1 text-slate-600">Visit date</Label>
                  <Input id="grp-date" type="date" value={groupVisitDate} onChange={(e) => setGroupVisitDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="grp-contact" className="mb-1 text-slate-600">Contact name (optional)</Label>
                  <Input id="grp-contact" value={groupContactName} onChange={(e) => setGroupContactName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="grp-contact-phone" className="mb-1 text-slate-600">Contact phone (optional)</Label>
                  <Input id="grp-contact-phone" value={groupContactPhone} onChange={(e) => setGroupContactPhone(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="grp-size" className="mb-1 text-slate-600">Expected size (optional)</Label>
                  <Input id="grp-size" type="number" value={groupExpectedSize} onChange={(e) => setGroupExpectedSize(e.target.value)} />
                </div>
              </div>
              <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>Record group</Button>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {groupsLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
                ) : groups.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">No groups recorded yet.</div>
                ) : (
                  groups.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => selectGroup(g)}
                      className={`flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer ${
                        selectedGroupId === g.id ? 'bg-[#1E2A44]/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">{g.name}</p>
                        <p className="text-xs text-slate-400">
                          {groupTypes.find((t) => t.key === g.groupType)?.label ?? g.groupType} · Visited {g.visitDate.slice(0, 10)}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[g.status]}`}>
                        {STATUSES.find((s) => s.value === g.status)?.label ?? g.status}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                {!selectedGroup ? (
                  <div className="py-8 text-center text-sm text-slate-400">Select a group to manage its visit.</div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h2 className="font-serif text-lg text-[#1E2A44]">{selectedGroup.name}</h2>
                        <p className="text-xs text-slate-400">
                          {selectedGroup.contactName ?? 'No contact recorded'}
                          {selectedGroup.expectedSize ? ` · ~${selectedGroup.expectedSize} people` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveGroup(selectedGroup.id)}
                        className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mb-4">
                      <Label className="mb-1 text-slate-600">Status</Label>
                      <select
                        value={selectedGroup.status}
                        onChange={(e) => handleGroupStatusChange(selectedGroup.id, e.target.value)}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                      >
                        {GROUP_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-4 pb-4 border-b border-slate-100">
                      <Label className="mb-1 text-slate-600">Members ({groupMembers.length})</Label>
                      {groupMembers.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          No individual visitors linked yet — add them from the Individuals tab and select this group.
                        </p>
                      ) : (
                        <ul className="text-sm text-slate-600 space-y-1">
                          {groupMembers.map((m) => (
                            <li key={m.id}>{m.firstName} {m.lastName}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <ActivityPanel
                      activityTypes={activityTypes}
                      activities={groupActivities}
                      activitiesLoading={groupActivitiesLoading}
                      onAdd={async (activityType, outcome, notes, customFields) => {
                        const res = await visitorGroupsApi.addActivity(TENANT_SLUG, selectedGroup.id, {
                          activityType,
                          outcome: outcome || undefined,
                          notes: notes || undefined,
                          customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
                        });
                        if (res.success) loadGroupDetail(selectedGroup.id);
                        else setError(res.error?.message ?? 'Could not log the activity.');
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
