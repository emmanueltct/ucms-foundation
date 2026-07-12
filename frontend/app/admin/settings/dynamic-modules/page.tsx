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
import {
  dynamicModuleDefinitionsApi,
  approvalWorkflowsApi,
  resourceAssignmentsApi,
  branchesApi,
  ministriesApi,
  smallGroupsApi,
  configApi,
  usersApi,
  visitorsApi,
  membersApi,
  isAccessDeniedResponse,
  DynamicModuleDefinition,
  ApprovalWorkflow,
  ResourceAssignment,
  Branch,
  Ministry,
  SmallGroup,
  AppUser,
  Visitor,
  Member,
} from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { IconPicker } from '../../../../components/icon-picker';
import { AccessDenied } from '../../../../components/access-denied';
import { UserSearchPicker } from '../../../../components/user-search-picker';
import { VisitorSearchPicker } from '../../../../components/visitor-search-picker';
import { MemberSearchPicker } from '../../../../components/member-search-picker';

const TENANT_SLUG = 'demo-church';

/** Matches the convention `ResourceAssignmentsService`/`FormAssignmentNotifier` already use for "this resource is a form/module." */
const FORM_RESOURCE_TYPE = 'dynamic_module_definition';

interface UserCategoryOption {
  id: string;
  label: string;
}

type ScopeKind = 'branch' | 'ministry' | 'small_group' | 'user_category' | 'user' | 'visitor' | 'member';

/** 'user'/'visitor'/'member' target one specific person/record via a search-picker (see ModuleAssignmentPanel) — "assign to all" isn't a meaningful action for them the way it is for the other four, so `plural` goes unused for those three. */
const SCOPE_KINDS: { value: ScopeKind; label: string; plural: string }[] = [
  { value: 'branch', label: 'Branch', plural: 'branches' },
  { value: 'ministry', label: 'Ministry (e.g. Choir)', plural: 'ministries' },
  { value: 'small_group', label: 'Small Group (e.g. Family Group)', plural: 'small groups' },
  { value: 'user_category', label: 'User Category', plural: 'user categories' },
  { value: 'user', label: 'Staff member', plural: 'staff members' },
  { value: 'visitor', label: 'Visitor', plural: 'visitors' },
  { value: 'member', label: 'Member', plural: 'members' },
];

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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [smallGroups, setSmallGroups] = useState<SmallGroup[]>([]);
  const [userCategories, setUserCategories] = useState<UserCategoryOption[]>([]);
  const [expandedAssignId, setExpandedAssignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [statusesText, setStatusesText] = useState('open, closed');
  const [attachableText, setAttachableText] = useState('');
  const [approvalWorkflowId, setApprovalWorkflowId] = useState('');
  const [showInNav, setShowInNav] = useState(false);
  const [allowPublicSubmission, setAllowPublicSubmission] = useState(false);
  const [allowMemberAttachment, setAllowMemberAttachment] = useState(false);

  // A module can't be created with zero attachments — every form must be
  // deliberately given to someone/somewhere (a branch, department/group, a
  // specific staff member, visitor, or member) at creation time, not left
  // floating and reachable by nobody. The existing "Assign to…" panel below
  // stays available afterward for adding more.
  const [createScopeKind, setCreateScopeKind] = useState<ScopeKind>('branch');
  const [createSelectedIds, setCreateSelectedIds] = useState<Set<string>>(new Set());
  const [createAllSelected, setCreateAllSelected] = useState(false);
  const [createUsers, setCreateUsers] = useState<AppUser[]>([]);
  const [createVisitors, setCreateVisitors] = useState<Visitor[]>([]);
  const [createMembers, setCreateMembers] = useState<Member[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (createScopeKind === 'user' && createUsers.length === 0) {
      usersApi.list(TENANT_SLUG).then((res) => {
        if (res.success && res.data) setCreateUsers(res.data);
      });
    } else if (createScopeKind === 'visitor' && createVisitors.length === 0) {
      visitorsApi.list(TENANT_SLUG).then((res) => {
        if (res.success && res.data) setCreateVisitors(res.data);
      });
    } else if (createScopeKind === 'member' && createMembers.length === 0) {
      membersApi.list(TENANT_SLUG).then((res) => {
        if (res.success && res.data) setCreateMembers(res.data);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createScopeKind]);

  const createSingleEntityKind = createScopeKind === 'user' || createScopeKind === 'visitor' || createScopeKind === 'member';

  function createOptionsFor(kind: ScopeKind): { id: string; label: string }[] {
    if (kind === 'branch') return branches.map((b) => ({ id: b.id, label: b.name }));
    if (kind === 'ministry') return ministries.map((m) => ({ id: m.id, label: m.name }));
    if (kind === 'small_group') return smallGroups.map((g) => ({ id: g.id, label: g.name }));
    if (kind === 'user_category') return userCategories.map((c) => ({ id: c.id, label: c.label }));
    if (kind === 'user') return createUsers.map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}` }));
    if (kind === 'visitor') return createVisitors.map((v) => ({ id: v.id, label: `${v.firstName} ${v.lastName}` }));
    return createMembers.map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}` }));
  }

  function toggleCreateId(id: string) {
    setCreateSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const createOptions = createOptionsFor(createScopeKind);
  const hasAttachTarget = createAllSelected ? createOptions.length > 0 : createSelectedIds.size > 0;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [modulesRes, workflowsRes, branchesRes, ministriesRes, smallGroupsRes, userCategoriesRes] = await Promise.all([
        dynamicModuleDefinitionsApi.list(TENANT_SLUG, undefined, true),
        approvalWorkflowsApi.list(TENANT_SLUG),
        branchesApi.list(TENANT_SLUG),
        ministriesApi.list(TENANT_SLUG),
        smallGroupsApi.list(TENANT_SLUG),
        configApi.listByNamespace(TENANT_SLUG, 'user_category'),
      ]);
      if (isAccessDeniedResponse(modulesRes)) {
        setAccessDenied(true);
        return;
      }
      if (modulesRes.success && modulesRes.data) setModules(modulesRes.data);
      else setError(modulesRes.error?.message ?? 'Could not load modules.');
      if (workflowsRes.success && workflowsRes.data) setWorkflows(workflowsRes.data);
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
      if (ministriesRes.success && ministriesRes.data) setMinistries(ministriesRes.data);
      if (smallGroupsRes.success && smallGroupsRes.data) setSmallGroups(smallGroupsRes.data);
      if (userCategoriesRes.success && userCategoriesRes.data) setUserCategories(userCategoriesRes.data);
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
    if (!label.trim() || !key.trim() || !hasAttachTarget) return;
    setCreating(true);
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
        allowPublicSubmission,
        allowMemberAttachment,
      });
      if (res.success && res.data) {
        const targetIds = createAllSelected ? createOptions.map((o) => o.id) : Array.from(createSelectedIds);
        const attachResults = await Promise.all(
          targetIds.map((id) =>
            resourceAssignmentsApi.create(TENANT_SLUG, {
              scopeEntityType: createScopeKind,
              scopeEntityId: id,
              resourceType: FORM_RESOURCE_TYPE,
              resourceKey: res.data!.id,
            }),
          ),
        );
        const failedAttach = attachResults.find((r) => !r.success);
        if (failedAttach) {
          setError(`Module created, but some attachments could not be saved: ${failedAttach.error?.message ?? 'unknown error'}`);
        }
        setLabel('');
        setKey('');
        setKeyEdited(false);
        setDescription('');
        setIcon('');
        setStatusesText('open, closed');
        setAttachableText('');
        setApprovalWorkflowId('');
        setShowInNav(false);
        setAllowPublicSubmission(false);
        setAllowMemberAttachment(false);
        setCreateScopeKind('branch');
        setCreateSelectedIds(new Set());
        setCreateAllSelected(false);
        load();
      } else {
        setError(res.error?.message ?? 'Could not create the module.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setCreating(false);
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

  async function handleTogglePublicSubmission(mod: DynamicModuleDefinition) {
    try {
      const res = await dynamicModuleDefinitionsApi.update(TENANT_SLUG, mod.id, { allowPublicSubmission: !mod.allowPublicSubmission });
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not update the module.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleToggleMemberAttachment(mod: DynamicModuleDefinition) {
    try {
      const res = await dynamicModuleDefinitionsApi.update(TENANT_SLUG, mod.id, { allowMemberAttachment: !mod.allowMemberAttachment });
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

  async function handleToggleActive(mod: DynamicModuleDefinition) {
    try {
      const res = await dynamicModuleDefinitionsApi.update(TENANT_SLUG, mod.id, { isActive: !mod.isActive });
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not update the module.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  if (accessDenied) return <AccessDenied />;

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
              <Label htmlFor="dm-icon" className="mb-1 text-slate-600">Icon (optional)</Label>
              <IconPicker id="dm-icon" value={icon} onChange={setIcon} />
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
            <div className="flex items-center gap-2 pt-5">
              <input
                id="dm-public"
                type="checkbox"
                checked={allowPublicSubmission}
                onChange={(e) => setAllowPublicSubmission(e.target.checked)}
              />
              <Label htmlFor="dm-public" className="text-slate-600">
                Allow guest submissions (also needs the Guest Access toggle in Configuration Center)
              </Label>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                id="dm-members"
                type="checkbox"
                checked={allowMemberAttachment}
                onChange={(e) => setAllowMemberAttachment(e.target.checked)}
              />
              <Label htmlFor="dm-members" className="text-slate-600">
                Allow attaching Members to a record (off for modules with no reason to, e.g. an equipment log)
              </Label>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <Label className="mb-1 text-slate-600">Attach to (required)</Label>
            <p className="text-xs text-slate-400 mb-2">Who should this form reach? Add more later from "Assign to…" below.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              <select
                value={createScopeKind}
                onChange={(e) => {
                  setCreateScopeKind(e.target.value as ScopeKind);
                  setCreateSelectedIds(new Set());
                  setCreateAllSelected(false);
                }}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700"
              >
                {SCOPE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>

            {createSingleEntityKind ? (
              <>
                {createScopeKind === 'user' && (
                  <UserSearchPicker
                    users={createUsers}
                    value={Array.from(createSelectedIds)[0] ?? ''}
                    onChange={(id) => setCreateSelectedIds(id ? new Set([id]) : new Set())}
                  />
                )}
                {createScopeKind === 'visitor' && (
                  <VisitorSearchPicker
                    visitors={createVisitors}
                    value={Array.from(createSelectedIds)[0] ?? ''}
                    onChange={(id) => setCreateSelectedIds(id ? new Set([id]) : new Set())}
                  />
                )}
                {createScopeKind === 'member' && (
                  <MemberSearchPicker
                    members={createMembers}
                    value={Array.from(createSelectedIds)[0] ?? ''}
                    onChange={(id) => setCreateSelectedIds(id ? new Set([id]) : new Set())}
                  />
                )}
              </>
            ) : (
              <>
                <label className="flex items-center gap-2 text-xs text-slate-600 mb-1.5">
                  <input
                    type="checkbox"
                    checked={createAllSelected}
                    onChange={(e) => {
                      setCreateAllSelected(e.target.checked);
                      setCreateSelectedIds(new Set());
                    }}
                  />
                  All {SCOPE_KINDS.find((k) => k.value === createScopeKind)?.plural} currently in this church
                </label>
                {!createAllSelected && (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {createOptions.length === 0 ? (
                      <p className="text-xs text-slate-400">None defined yet.</p>
                    ) : (
                      createOptions.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => toggleCreateId(o.id)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                            createSelectedIds.has(o.id) ? 'border-[#1E2A44] bg-[#1E2A44]/5 text-[#1E2A44]' : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <Button type="submit" disabled={creating || !hasAttachTarget} style={{ backgroundColor: '#1E2A44' }}>
            {creating ? 'Creating…' : 'Create module'}
          </Button>
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
              <div key={m.id} className={`border-b border-slate-50 last:border-0 ${!m.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                      {m.label}
                      {m.allowPublicSubmission && (
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-[#C9A24B] border border-[#C9A24B]/40 rounded-full px-2 py-0.5">
                          Public
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      {m.key} · {m.statuses.join(' → ')} · custom fields entityType:{' '}
                      <code className="text-[11px]">dynamicmodule:{m.id}</code>
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      href={`/admin/modules/${m.key}`}
                      className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                    >
                      Manage records
                    </Link>
                    <button
                      onClick={() => setExpandedAssignId((v) => (v === m.id ? null : m.id))}
                      className={`text-xs font-medium px-3 py-1 rounded-full border ${
                        expandedAssignId === m.id ? 'border-[#1E2A44] text-[#1E2A44]' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {expandedAssignId === m.id ? 'Close assign' : 'Assign to…'}
                    </button>
                    <button
                      onClick={() => handleToggleNav(m)}
                      className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                    >
                      {m.showInNav ? 'Hide from nav' : 'Show in nav'}
                    </button>
                    <button
                      onClick={() => handleTogglePublicSubmission(m)}
                      className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                    >
                      {m.allowPublicSubmission ? 'Disable guest form' : 'Allow guest form'}
                    </button>
                    <button
                      onClick={() => handleToggleMemberAttachment(m)}
                      className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                    >
                      {m.allowMemberAttachment ? 'Disable members' : 'Allow members'}
                    </button>
                    <button
                      onClick={() => handleToggleActive(m)}
                      className={`text-xs font-medium px-3 py-1 rounded-full border ${
                        m.isActive ? 'border-slate-200 text-slate-600 hover:border-slate-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {m.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleRemove(m.id)}
                      className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {expandedAssignId === m.id && (
                  <ModuleAssignmentPanel
                    moduleId={m.id}
                    branches={branches}
                    ministries={ministries}
                    smallGroups={smallGroups}
                    userCategories={userCategories}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Assigns this module (as a `dynamic_module_definition` resource, the same
 * convention `FormAssignmentNotifier`/§14 already use) to a Branch, Ministry,
 * Small Group, or User Category — right from the Builder, instead of having
 * to go find the target branch/department page and assign from there.
 * "All" creates one `ResourceAssignment` per entity that exists right now
 * (a snapshot, not a live wildcard) — simple and exactly as debuggable as
 * assigning to each one by hand. A Ministry/Small Group assignment reaches
 * that entity's appointed leader (via `LeadershipAppointment`) — these are
 * `User`-based scopes, not the group's general Member roster, which this
 * eligibility mechanism deliberately doesn't reach (see
 * docs/leadership/business-analysis.md).
 */
function ModuleAssignmentPanel({
  moduleId,
  branches,
  ministries,
  smallGroups,
  userCategories,
}: {
  moduleId: string;
  branches: Branch[];
  ministries: Ministry[];
  smallGroups: SmallGroup[];
  userCategories: UserCategoryOption[];
}) {
  const [scopeKind, setScopeKind] = useState<ScopeKind>('branch');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const [dueAt, setDueAt] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignments, setAssignments] = useState<ResourceAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazily loaded — only fetched the first time an admin actually picks
  // "Staff member"/"Visitor"/"Member" as the assign-to kind, since these
  // lists can be much larger than the branch/ministry/small-group/category
  // lists already loaded up front by the parent page.
  const [users, setUsers] = useState<AppUser[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [entityMembers, setEntityMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (scopeKind === 'user' && users.length === 0) {
      usersApi.list(TENANT_SLUG).then((res) => {
        if (res.success && res.data) setUsers(res.data);
      });
    } else if (scopeKind === 'visitor' && visitors.length === 0) {
      visitorsApi.list(TENANT_SLUG).then((res) => {
        if (res.success && res.data) setVisitors(res.data);
      });
    } else if (scopeKind === 'member' && entityMembers.length === 0) {
      membersApi.list(TENANT_SLUG).then((res) => {
        if (res.success && res.data) setEntityMembers(res.data);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKind]);

  const singleEntityKind = scopeKind === 'user' || scopeKind === 'visitor' || scopeKind === 'member';

  function optionsFor(kind: ScopeKind): { id: string; label: string }[] {
    if (kind === 'branch') return branches.map((b) => ({ id: b.id, label: b.name }));
    if (kind === 'ministry') return ministries.map((m) => ({ id: m.id, label: m.name }));
    if (kind === 'small_group') return smallGroups.map((g) => ({ id: g.id, label: g.name }));
    if (kind === 'user_category') return userCategories.map((c) => ({ id: c.id, label: c.label }));
    if (kind === 'user') return users.map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}` }));
    if (kind === 'visitor') return visitors.map((v) => ({ id: v.id, label: `${v.firstName} ${v.lastName}` }));
    return entityMembers.map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}` }));
  }

  async function loadAssignments() {
    setAssignmentsLoading(true);
    const res = await resourceAssignmentsApi.list(TENANT_SLUG, { resourceType: FORM_RESOURCE_TYPE, resourceKey: moduleId });
    if (res.success && res.data) setAssignments(res.data);
    else setError(res.error?.message ?? 'Could not load current assignments.');
    setAssignmentsLoading(false);
  }

  useEffect(() => {
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    const options = optionsFor(scopeKind);
    const targetIds = allSelected ? options.map((o) => o.id) : Array.from(selectedIds);
    if (targetIds.length === 0) return;
    setAssigning(true);
    setError(null);
    try {
      const results = await Promise.all(
        targetIds.map((id) =>
          resourceAssignmentsApi.create(TENANT_SLUG, {
            scopeEntityType: scopeKind,
            scopeEntityId: id,
            resourceType: FORM_RESOURCE_TYPE,
            resourceKey: moduleId,
            dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          }),
        ),
      );
      const failed = results.find((r) => !r.success);
      if (failed) setError(failed.error?.message ?? 'Some assignments could not be created.');
      setSelectedIds(new Set());
      setAllSelected(false);
      setDueAt('');
      loadAssignments();
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemove(id: string) {
    const res = await resourceAssignmentsApi.remove(TENANT_SLUG, id);
    if (res.success) loadAssignments();
    else setError(res.error?.message ?? 'Could not remove the assignment.');
  }

  function assignmentLabel(a: ResourceAssignment): string {
    const kind = a.scopeEntityType as ScopeKind;
    const options = SCOPE_KINDS.some((k) => k.value === kind) ? optionsFor(kind) : [];
    const name = options.find((o) => o.id === a.scopeEntityId)?.label ?? a.scopeEntityId;
    const kindLabel = SCOPE_KINDS.find((k) => k.value === kind)?.label ?? kind;
    return `${kindLabel}: ${name}`;
  }

  const currentOptions = optionsFor(scopeKind);

  return (
    <div className="px-4 pb-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mb-3">{error}</div>}

        <form onSubmit={handleAssign} className="space-y-2 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="mb-1 text-slate-600">Assign to</Label>
              <select
                value={scopeKind}
                onChange={(e) => {
                  setScopeKind(e.target.value as ScopeKind);
                  setSelectedIds(new Set());
                  setAllSelected(false);
                }}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700"
              >
                {SCOPE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1 text-slate-600">Deadline (optional)</Label>
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" size="sm" disabled={assigning || (!allSelected && selectedIds.size === 0)} style={{ backgroundColor: '#1E2A44' }}>
                {assigning ? 'Assigning…' : 'Assign'}
              </Button>
            </div>
          </div>

          <div>
            {singleEntityKind ? (
              <>
                <Label className="mb-1 text-slate-600">
                  {scopeKind === 'user' ? 'Which staff member' : scopeKind === 'visitor' ? 'Which visitor' : 'Which member'}
                </Label>
                {scopeKind === 'user' && (
                  <UserSearchPicker
                    users={users}
                    value={Array.from(selectedIds)[0] ?? ''}
                    onChange={(id) => setSelectedIds(id ? new Set([id]) : new Set())}
                  />
                )}
                {scopeKind === 'visitor' && (
                  <VisitorSearchPicker
                    visitors={visitors}
                    value={Array.from(selectedIds)[0] ?? ''}
                    onChange={(id) => setSelectedIds(id ? new Set([id]) : new Set())}
                  />
                )}
                {scopeKind === 'member' && (
                  <MemberSearchPicker
                    members={entityMembers}
                    value={Array.from(selectedIds)[0] ?? ''}
                    onChange={(id) => setSelectedIds(id ? new Set([id]) : new Set())}
                  />
                )}
              </>
            ) : (
              <>
                <label className="flex items-center gap-2 text-xs text-slate-600 mb-1.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => {
                      setAllSelected(e.target.checked);
                      setSelectedIds(new Set());
                    }}
                  />
                  All {SCOPE_KINDS.find((k) => k.value === scopeKind)?.plural} currently in this church
                  {scopeKind !== 'branch' && ' (reaches each one\'s assigned leader)'}
                </label>
                {!allSelected && (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {currentOptions.length === 0 ? (
                  <p className="text-xs text-slate-400">None defined yet.</p>
                ) : (
                  currentOptions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggleId(o.id)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                        selectedIds.has(o.id) ? 'border-[#1E2A44] bg-[#1E2A44]/5 text-[#1E2A44]' : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))
                )}
              </div>
                )}
              </>
            )}
          </div>
        </form>

        <p className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1.5">Currently assigned to</p>
        {assignmentsLoading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : assignments.length === 0 ? (
          <p className="text-xs text-slate-400">Nothing assigned yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-slate-700">
                  {assignmentLabel(a)}
                  {a.dueAt ? ` · due ${new Date(a.dueAt).toLocaleDateString()}` : ''}
                </span>
                <button onClick={() => handleRemove(a.id)} className="text-xs text-red-500 hover:underline">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
