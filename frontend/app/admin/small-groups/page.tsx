'use client';

// app/admin/small-groups/page.tsx
// Lets a Church Administrator create small groups (home groups, cell
// groups, Bible studies) and children's/youth classes (Sunday School), then
// manage each one's roster — who's in it, and in what role.

import { useEffect, useState } from 'react';
import {
  smallGroupsApi,
  smallGroupMembershipsApi,
  branchesApi,
  membersApi,
  configApi,
  isAccessDeniedResponse,
  SmallGroup,
  SmallGroupMembership,
  Branch,
  Member,
} from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { AccessDenied } from '../../../components/access-denied';

const TENANT_SLUG = 'demo-church';
const ROLES = ['leader', 'co_leader', 'member'];
const MEETING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function SmallGroupsAdminPage() {
  const [groups, setGroups] = useState<SmallGroup[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [groupTypes, setGroupTypes] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [name, setName] = useState('');
  const [groupType, setGroupType] = useState('');
  const [branchId, setBranchId] = useState('');
  const [meetingDay, setMeetingDay] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [roster, setRoster] = useState<SmallGroupMembership[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [groupsRes, branchesRes, membersRes, typesRes] = await Promise.all([
        smallGroupsApi.list(TENANT_SLUG),
        branchesApi.list(TENANT_SLUG),
        membersApi.list(TENANT_SLUG, {}),
        configApi.listByNamespace(TENANT_SLUG, 'small_group_type'),
      ]);
      if (isAccessDeniedResponse(groupsRes)) {
        setAccessDenied(true);
        return;
      }
      if (groupsRes.success && groupsRes.data) setGroups(groupsRes.data);
      else setError(groupsRes.error?.message ?? 'Could not load small groups.');
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
      if (membersRes.success && membersRes.data) setMembers(membersRes.data);
      if (typesRes.success && typesRes.data) setGroupTypes(typesRes.data as { key: string; label: string }[]);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadRoster(groupId: string) {
    setRosterLoading(true);
    try {
      const res = await smallGroupMembershipsApi.list(TENANT_SLUG, { smallGroupId: groupId });
      if (res.success && res.data) setRoster(res.data);
      else setError(res.error?.message ?? 'Could not load the roster.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setRosterLoading(false);
    }
  }

  function selectGroup(group: SmallGroup) {
    setSelectedGroupId(group.id);
    loadRoster(group.id);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await smallGroupsApi.create(TENANT_SLUG, {
        name: name.trim(),
        groupType: groupType || undefined,
        branchId: branchId || undefined,
        meetingDay: meetingDay || undefined,
        meetingTime: meetingTime || undefined,
        location: location.trim() || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        minAge: minAge ? Number(minAge) : undefined,
        maxAge: maxAge ? Number(maxAge) : undefined,
      });
      if (res.success) {
        setName('');
        setGroupType('');
        setBranchId('');
        setMeetingDay('');
        setMeetingTime('');
        setLocation('');
        setCapacity('');
        setMinAge('');
        setMaxAge('');
        load();
      } else {
        setError(res.error?.message ?? 'Could not create the small group.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemoveGroup(id: string) {
    try {
      const res = await smallGroupsApi.remove(TENANT_SLUG, id);
      if (res.success) {
        if (selectedGroupId === id) setSelectedGroupId(null);
        load();
      } else {
        setError(res.error?.message ?? 'Could not remove the small group.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGroupId || !newMemberId) return;
    try {
      const res = await smallGroupMembershipsApi.create(TENANT_SLUG, {
        smallGroupId: selectedGroupId,
        memberId: newMemberId,
        role: newMemberRole,
      });
      if (res.success) {
        setNewMemberId('');
        loadRoster(selectedGroupId);
      } else {
        setError(res.error?.message ?? 'Could not add the member.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemoveMember(id: string) {
    if (!selectedGroupId) return;
    try {
      const res = await smallGroupMembershipsApi.remove(TENANT_SLUG, id);
      if (res.success) loadRoster(selectedGroupId);
      else setError(res.error?.message ?? 'Could not remove the member.');
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

  function scheduleSummary(g: SmallGroup) {
    const parts: string[] = [];
    if (g.meetingDay) parts.push(g.meetingDay.charAt(0).toUpperCase() + g.meetingDay.slice(1));
    if (g.meetingTime) parts.push(g.meetingTime);
    if (g.minAge || g.maxAge) parts.push(`ages ${g.minAge ?? '0'}-${g.maxAge ?? '∞'}`);
    return parts.join(' · ');
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  const activeRosterCount = roster.filter((r) => r.isActive).length;

  if (accessDenied) return <AccessDenied />;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Small Groups &amp; Children&rsquo;s Ministry</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Small Groups</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Home groups, cell groups, Bible studies, and age-graded Sunday School classes —
            each with its own schedule, location, capacity, and roster.
          </p>
        </header>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="sg-name" className="mb-1 text-slate-600">Name</Label>
              <Input id="sg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kimironko Home Group" />
            </div>
            <div>
              <Label htmlFor="sg-type" className="mb-1 text-slate-600">Type (optional)</Label>
              <select
                id="sg-type"
                value={groupType}
                onChange={(e) => setGroupType(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Unspecified —</option>
                {groupTypes.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="sg-branch" className="mb-1 text-slate-600">Branch (optional)</Label>
              <select
                id="sg-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Church-wide —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="sg-day" className="mb-1 text-slate-600">Meeting day (optional)</Label>
              <select
                id="sg-day"
                value={meetingDay}
                onChange={(e) => setMeetingDay(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Unspecified —</option>
                {MEETING_DAYS.map((d) => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="sg-time" className="mb-1 text-slate-600">Meeting time (optional)</Label>
              <Input id="sg-time" type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="sg-location" className="mb-1 text-slate-600">Location (optional)</Label>
              <Input id="sg-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Uwase residence, Kimironko" />
            </div>
            <div>
              <Label htmlFor="sg-capacity" className="mb-1 text-slate-600">Capacity (optional)</Label>
              <Input id="sg-capacity" type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="15" />
            </div>
            <div>
              <Label htmlFor="sg-min-age" className="mb-1 text-slate-600">Min age (optional)</Label>
              <Input id="sg-min-age" type="number" min="0" value={minAge} onChange={(e) => setMinAge(e.target.value)} placeholder="6" />
            </div>
            <div>
              <Label htmlFor="sg-max-age" className="mb-1 text-slate-600">Max age (optional)</Label>
              <Input id="sg-max-age" type="number" min="0" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} placeholder="9" />
            </div>
          </div>
          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>Create small group</Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : groups.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No small groups yet. Create your first one above.</div>
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
                      {branchName(g.branchId)}
                      {g.groupType ? ` · ${g.groupType.replace(/_/g, ' ')}` : ''}
                      {scheduleSummary(g) ? ` · ${scheduleSummary(g)}` : ''}
                      {g.capacity ? ` · cap ${g.capacity}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveGroup(g.id);
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
            {!selectedGroup ? (
              <div className="py-8 text-center text-sm text-slate-400">Select a small group to manage its roster.</div>
            ) : (
              <>
                <h2 className="font-serif text-lg text-[#1E2A44] mb-1">{selectedGroup.name} roster</h2>
                {selectedGroup.capacity && (
                  <p className="text-xs text-slate-400 mb-3">{activeRosterCount} / {selectedGroup.capacity} members</p>
                )}
                <form onSubmit={handleAddMember} className="flex gap-2 mb-4">
                  <select
                    value={newMemberId}
                    onChange={(e) => setNewMemberId(e.target.value)}
                    className="flex-1 h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                  >
                    <option value="">— Select a member —</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                    ))}
                  </select>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" style={{ backgroundColor: '#1E2A44' }}>Add</Button>
                </form>

                {rosterLoading ? (
                  <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
                ) : roster.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">No members yet.</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {roster.map((r) => (
                      <div key={r.id} className="flex items-center justify-between py-2">
                        <div>
                          <p className={`text-sm font-medium ${r.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                            {memberName(r.memberId)}
                          </p>
                          <p className="text-xs text-slate-400">{r.role.replace(/_/g, ' ')}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(r.id)}
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
