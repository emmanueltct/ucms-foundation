'use client';

// app/admin/members/page.tsx
// Lets a Church Administrator manage member profiles — attached to a Branch
// (Module 1) and optionally grouped into a Family — through the Member &
// Family Management module.

import { useEffect, useState } from 'react';
import {
  membersApi,
  branchesApi,
  familiesApi,
  configApi,
  customFieldDefinitionsApi,
  reportsApi,
  Member,
  Branch,
  Family,
  CustomFieldDefinition,
  MemberActivityHistory,
} from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { DynamicCustomFields } from '../../../components/dynamic-custom-fields';

const TENANT_SLUG = 'demo-church'; // in production this comes from the resolved workspace/domain

const STATUS_STYLES: Record<string, string> = {
  active: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  inactive: 'text-slate-500 bg-slate-100 border-slate-200',
  transferred: 'text-amber-700 bg-amber-50 border-amber-200',
  deceased: 'text-slate-400 bg-slate-50 border-slate-200',
};

const TIMELINE_KIND_LABELS: Record<string, string> = {
  ministry: 'Ministry',
  small_group: 'Small Group',
  event: 'Event',
  attendance: 'Attendance',
  contribution: 'Giving',
  activity: 'Activity',
};

export default function MembersAdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const [activityTypes, setActivityTypes] = useState<{ key: string; label: string }[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [history, setHistory] = useState<MemberActivityHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activityType, setActivityType] = useState('');
  const [activityOutcome, setActivityOutcome] = useState('');
  const [activityCustomFieldDefs, setActivityCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [activityCustomFieldValues, setActivityCustomFieldValues] = useState<Record<string, unknown>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, branchesRes, familiesRes, customFieldsRes, activityTypesRes] = await Promise.all([
        membersApi.list(TENANT_SLUG, { search: search || undefined, branchId: branchFilter || undefined }),
        branchesApi.list(TENANT_SLUG),
        familiesApi.list(TENANT_SLUG),
        customFieldDefinitionsApi.list(TENANT_SLUG, { entityType: 'member' }),
        configApi.listByNamespace(TENANT_SLUG, 'member_activity_type'),
      ]);
      if (membersRes.success && membersRes.data) setMembers(membersRes.data);
      else setError(membersRes.error?.message ?? 'Could not load members.');
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
      if (familiesRes.success && familiesRes.data) setFamilies(familiesRes.data);
      if (customFieldsRes.success && customFieldsRes.data) setCustomFieldDefs(customFieldsRes.data);
      if (activityTypesRes.success && activityTypesRes.data) setActivityTypes(activityTypesRes.data as { key: string; label: string }[]);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, branchFilter]);

  useEffect(() => {
    if (!activityType) {
      setActivityCustomFieldDefs([]);
      return;
    }
    customFieldDefinitionsApi.list(TENANT_SLUG, { entityType: `member_activity:${activityType}` }).then((res) => {
      if (res.success && res.data) setActivityCustomFieldDefs(res.data);
    });
    setActivityCustomFieldValues({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityType]);

  async function loadHistory(memberId: string) {
    setSelectedMemberId(memberId);
    setHistoryLoading(true);
    try {
      const res = await reportsApi.memberActivityHistory(TENANT_SLUG, memberId);
      if (res.success && res.data) setHistory(res.data);
      else setError(res.error?.message ?? "Could not load this member's activity history.");
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMemberId || !activityType) return;
    try {
      const res = await membersApi.addActivity(TENANT_SLUG, selectedMemberId, {
        activityType,
        outcome: activityOutcome.trim() || undefined,
        customFields: Object.keys(activityCustomFieldValues).length > 0 ? activityCustomFieldValues : undefined,
      });
      if (res.success) {
        setActivityType('');
        setActivityOutcome('');
        setActivityCustomFieldValues({});
        loadHistory(selectedMemberId);
      } else {
        setError(res.error?.message ?? 'Could not log the activity.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !branchId) {
      setError('First name, last name, and branch are required.');
      return;
    }
    try {
      const res = await membersApi.create(TENANT_SLUG, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        branchId,
        familyId: familyId || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
      });
      if (res.success) {
        setFirstName('');
        setLastName('');
        setFamilyId('');
        setPhone('');
        setEmail('');
        setCustomFieldValues({});
        load();
      } else {
        setError(res.error?.message ?? 'Could not create the member.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleTransfer(member: Member, newBranchId: string) {
    if (!newBranchId || newBranchId === member.branchId) return;
    try {
      const res = await membersApi.transfer(TENANT_SLUG, member.id, newBranchId);
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not transfer the member.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemove(member: Member) {
    try {
      const res = await membersApi.remove(TENANT_SLUG, member.id);
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not remove the member.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function branchName(id: string) {
    return branches.find((b) => b.id === id)?.name ?? '—';
  }

  function familyName(id: string | null) {
    if (!id) return '—';
    return families.find((f) => f.id === id)?.name ?? '—';
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Member &amp; Family Management</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Members</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Every member is attached to a branch from your organizational structure, and can
            optionally belong to a family/household. Finance and Attendance will attach their
            own records to whoever you build here.
          </p>
        </header>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="member-first-name" className="mb-1 text-slate-600">
                First name
              </Label>
              <Input id="member-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" />
            </div>
            <div>
              <Label htmlFor="member-last-name" className="mb-1 text-slate-600">
                Last name
              </Label>
              <Input id="member-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Uwimana" />
            </div>
            <div>
              <Label htmlFor="member-branch" className="mb-1 text-slate-600">
                Branch
              </Label>
              <select
                id="member-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Select a branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="member-family" className="mb-1 text-slate-600">
                Family (optional)
              </Label>
              <select
                id="member-family"
                value={familyId}
                onChange={(e) => setFamilyId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— None —</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="member-phone" className="mb-1 text-slate-600">
                Phone (optional)
              </Label>
              <Input id="member-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+250780000000" />
            </div>
            <div>
              <Label htmlFor="member-email" className="mb-1 text-slate-600">
                Email (optional)
              </Label>
              <Input id="member-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@example.com" />
            </div>
          </div>

          {customFieldDefs.length > 0 && (
            <>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">
                  This church&rsquo;s custom fields
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <DynamicCustomFields
                  definitions={customFieldDefs}
                  values={customFieldValues}
                  onChange={(key, value) => setCustomFieldValues((prev) => ({ ...prev, [key]: value }))}
                />
              </div>
            </>
          )}

          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>
            Add member
          </Button>
        </form>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, membership number…"
            className="flex-1"
          />
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
              <button
                key={format}
                onClick={() => membersApi.export(TENANT_SLUG, format, { search: search || undefined, branchId: branchFilter || undefined })}
                className="text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-[#1E2A44]/40"
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : members.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No members yet. Add your first one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Branch</th>
                    <th className="px-4 py-3 font-medium">Family</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3">
                        <span className={`font-medium ${m.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {m.firstName} {m.lastName}
                        </span>
                        {m.membershipNumber && <p className="text-xs text-slate-400">{m.membershipNumber}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={m.branchId}
                          onChange={(e) => handleTransfer(m, e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                        >
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{familyName(m.familyId)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            STATUS_STYLES[m.membershipStatus] ?? STATUS_STYLES.inactive
                          }`}
                        >
                          {m.membershipStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {m.phone && <div>{m.phone}</div>}
                        {m.email && <div>{m.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => loadHistory(m.id)}
                          className={`text-xs font-medium px-3 py-1 rounded-full border ${
                            selectedMemberId === m.id
                              ? 'bg-[#1E2A44] text-white border-[#1E2A44]'
                              : 'border-slate-200 text-slate-600 hover:border-[#1E2A44]/40'
                          }`}
                        >
                          History
                        </button>
                        <button
                          onClick={() => handleRemove(m)}
                          className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">Branch is shown as an editable dropdown — changing it transfers the member.</p>

        {selectedMemberId && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            {historyLoading ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : !history ? (
              <div className="py-8 text-center text-sm text-slate-400">Could not load activity history.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h2 className="font-serif text-lg text-[#1E2A44] mb-1">
                    {history.member.firstName} {history.member.lastName}&rsquo;s activity history
                  </h2>
                  <p className="text-xs text-slate-400 mb-4">
                    {history.ministries.length} ministr{history.ministries.length === 1 ? 'y' : 'ies'} ·{' '}
                    {history.smallGroups.length} small group{history.smallGroups.length === 1 ? '' : 's'} ·{' '}
                    {history.eventsAttended.length} event{history.eventsAttended.length === 1 ? '' : 's'} ·{' '}
                    {history.attendance.totalCount} attendance record{history.attendance.totalCount === 1 ? '' : 's'} ·{' '}
                    {history.contributions.totalCount} contribution{history.contributions.totalCount === 1 ? '' : 's'}
                  </p>
                  <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                    {history.timeline.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4">No activity recorded yet.</p>
                    ) : (
                      history.timeline.map((t, i) => (
                        <div key={i} className="py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full border border-slate-200 text-slate-500">
                              {TIMELINE_KIND_LABELS[t.kind] ?? t.kind}
                            </span>
                            <span className="text-xs text-slate-400">{t.date.slice(0, 10)}</span>
                          </div>
                          <p className="text-sm text-slate-800 mt-1">{t.label}</p>
                          {t.detail && <p className="text-xs text-slate-500">{t.detail}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <Label className="mb-1 text-slate-600">Log a new activity</Label>
                  <form onSubmit={handleAddActivity} className="space-y-2">
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
                    <Input value={activityOutcome} onChange={(e) => setActivityOutcome(e.target.value)} placeholder="Outcome (optional)" />
                    {activityCustomFieldDefs.length > 0 && (
                      <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                        <DynamicCustomFields
                          definitions={activityCustomFieldDefs}
                          values={activityCustomFieldValues}
                          onChange={(key, value) => setActivityCustomFieldValues((prev) => ({ ...prev, [key]: value }))}
                        />
                      </div>
                    )}
                    <Button type="submit" size="sm" disabled={!activityType} style={{ backgroundColor: '#1E2A44' }}>
                      Log activity
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
