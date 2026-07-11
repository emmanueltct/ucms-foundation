'use client';

// app/admin/modules/[key]/page.tsx
// The generic record page every admin-defined Dynamic Module renders
// through — one page serving every module built on the Dynamic Module
// Builder (app/admin/settings/dynamic-modules), the same way
// DynamicCustomFields already renders any entity's fields from data alone.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  dynamicModuleDefinitionsApi,
  dynamicModuleRecordsApi,
  customFieldDefinitionsApi,
  branchesApi,
  entityMembershipsApi,
  membersApi,
  DynamicModuleDefinition,
  DynamicModuleRecord,
  CustomFieldDefinition,
  Branch,
  Member,
  EntityMembership,
} from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { DynamicCustomFields } from '../../../../components/dynamic-custom-fields';
import { MemberSearchPicker } from '../../../../components/member-search-picker';

const TENANT_SLUG = 'demo-church';

export default function DynamicModuleRecordsPage() {
  const params = useParams<{ key: string }>();
  const moduleKey = params.key;

  const [definition, setDefinition] = useState<DynamicModuleDefinition | null>(null);
  const [records, setRecords] = useState<DynamicModuleRecord[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState('');
  const [attachedToEntityType, setAttachedToEntityType] = useState('');
  const [attachedToEntityId, setAttachedToEntityId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [parentRecordId, setParentRecordId] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [attachableModuleRecords, setAttachableModuleRecords] = useState<DynamicModuleRecord[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [recordMemberships, setRecordMemberships] = useState<EntityMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');

  async function load() {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const defRes = await dynamicModuleDefinitionsApi.getByKey(TENANT_SLUG, moduleKey);
      if (!defRes.success || !defRes.data) {
        setNotFound(true);
        return;
      }
      setDefinition(defRes.data);

      const entityType = `dynamicmodule:${defRes.data.id}`;
      const [recordsRes, fieldsRes, branchesRes, membersRes] = await Promise.all([
        dynamicModuleRecordsApi.list(TENANT_SLUG, defRes.data.id),
        customFieldDefinitionsApi.list(TENANT_SLUG, { entityType }),
        branchesApi.list(TENANT_SLUG),
        membersApi.list(TENANT_SLUG, {}),
      ]);
      if (recordsRes.success && recordsRes.data) setRecords(recordsRes.data);
      if (fieldsRes.success && fieldsRes.data) setFieldDefinitions(fieldsRes.data);
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
      if (membersRes.success && membersRes.data) setMembers(membersRes.data);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMemberships(record: DynamicModuleRecord) {
    if (!definition) return;
    setMembershipsLoading(true);
    try {
      const res = await entityMembershipsApi.list(TENANT_SLUG, {
        attachedToEntityType: `dynamicmodule:${definition.id}`,
        attachedToEntityId: record.id,
      });
      if (res.success && res.data) setRecordMemberships(res.data);
      else setError(res.error?.message ?? 'Could not load members.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setMembershipsLoading(false);
    }
  }

  function selectRecord(record: DynamicModuleRecord) {
    setSelectedId(record.id);
    loadMemberships(record);
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!definition || !selectedRecord || !newMemberId) return;
    try {
      const res = await entityMembershipsApi.create(TENANT_SLUG, {
        attachedToEntityType: `dynamicmodule:${definition.id}`,
        attachedToEntityId: selectedRecord.id,
        memberId: newMemberId,
        role: newMemberRole,
      });
      if (res.success) {
        setNewMemberId('');
        loadMemberships(selectedRecord);
      } else {
        setError(res.error?.message ?? 'Could not add the member.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemoveMember(id: string) {
    if (!selectedRecord) return;
    try {
      const res = await entityMembershipsApi.remove(TENANT_SLUG, id);
      if (res.success) loadMemberships(selectedRecord);
      else setError(res.error?.message ?? 'Could not remove the member.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function memberName(id: string) {
    const m = members.find((mm) => mm.id === id);
    return m ? `${m.firstName} ${m.lastName}` : '—';
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  useEffect(() => {
    setAttachedToEntityId('');
    if (attachedToEntityType.startsWith('dynamicmodule:')) {
      const otherModuleId = attachedToEntityType.slice('dynamicmodule:'.length);
      dynamicModuleRecordsApi.list(TENANT_SLUG, otherModuleId).then((res) => {
        if (res.success && res.data) setAttachableModuleRecords(res.data);
      });
    } else {
      setAttachableModuleRecords([]);
    }
  }, [attachedToEntityType]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!definition) return;
    try {
      const res = await dynamicModuleRecordsApi.create(TENANT_SLUG, definition.id, {
        title: title.trim() || undefined,
        attachedToEntityType: attachedToEntityType.trim() || undefined,
        attachedToEntityId: attachedToEntityId.trim() || undefined,
        branchId: branchId || undefined,
        parentRecordId: parentRecordId || undefined,
        customFields: customFieldValues,
      });
      if (res.success) {
        setTitle('');
        setAttachedToEntityType('');
        setAttachedToEntityId('');
        setBranchId('');
        setParentRecordId('');
        setCustomFieldValues({});
        load();
      } else {
        setError(res.error?.message ?? 'Could not create the record.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleChangeStatus(record: DynamicModuleRecord, toStatus: string) {
    if (!definition) return;
    const reason = window.prompt(`Reason for moving this record to "${toStatus}":`);
    if (!reason || reason.trim().length < 3) {
      setError('A reason of at least 3 characters is required.');
      return;
    }
    try {
      const res = await dynamicModuleRecordsApi.changeStatus(TENANT_SLUG, definition.id, record.id, toStatus, reason.trim());
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not change the status.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemove(id: string) {
    if (!definition) return;
    try {
      const res = await dynamicModuleRecordsApi.remove(TENANT_SLUG, definition.id, id);
      if (res.success) {
        if (selectedId === id) setSelectedId(null);
        load();
      } else {
        setError(res.error?.message ?? 'Could not remove the record.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function branchName(id: string | null) {
    if (!id) return '—';
    return branches.find((b) => b.id === id)?.name ?? '—';
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#F7F6F2]">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <p className="text-sm text-slate-500">Module &quot;{moduleKey}&quot; was not found.</p>
        </div>
      </div>
    );
  }

  const selectedRecord = records.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Dynamic Module</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">{definition?.label ?? '…'}</h1>
          {definition?.description && <p className="text-sm text-slate-500 mt-2 max-w-xl">{definition.description}</p>}
        </header>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="dmr-title" className="mb-1 text-slate-600">Title (optional)</Label>
              <Input id="dmr-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="dmr-attach-type" className="mb-1 text-slate-600">Attach to (entity type, optional)</Label>
              {definition && definition.attachableToEntityTypes.length > 0 ? (
                <select
                  id="dmr-attach-type"
                  value={attachedToEntityType}
                  onChange={(e) => setAttachedToEntityType(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                >
                  <option value="">— Standalone —</option>
                  {definition.attachableToEntityTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              ) : (
                <Input id="dmr-attach-type" value={attachedToEntityType} onChange={(e) => setAttachedToEntityType(e.target.value)} placeholder="branch, ministry, member…" />
              )}
            </div>
            <div>
              <Label htmlFor="dmr-attach-id" className="mb-1 text-slate-600">Attach to (record, optional)</Label>
              {attachedToEntityType === 'member' ? (
                <MemberSearchPicker members={members} value={attachedToEntityId} onChange={setAttachedToEntityId} />
              ) : attachedToEntityType === 'branch' ? (
                <select
                  id="dmr-attach-id"
                  value={attachedToEntityId}
                  onChange={(e) => setAttachedToEntityId(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                >
                  <option value="">— Select a branch —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              ) : attachedToEntityType.startsWith('dynamicmodule:') ? (
                <select
                  id="dmr-attach-id"
                  value={attachedToEntityId}
                  onChange={(e) => setAttachedToEntityId(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                >
                  <option value="">— Select a record —</option>
                  {attachableModuleRecords.map((r) => (
                    <option key={r.id} value={r.id}>{r.title || `Record ${r.id.slice(0, 8)}`}</option>
                  ))}
                </select>
              ) : (
                <Input id="dmr-attach-id" value={attachedToEntityId} onChange={(e) => setAttachedToEntityId(e.target.value)} disabled={!attachedToEntityType} />
              )}
            </div>
            <div>
              <Label htmlFor="dmr-branch" className="mb-1 text-slate-600">Branch (optional)</Label>
              <select
                id="dmr-branch"
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
              <Label htmlFor="dmr-parent" className="mb-1 text-slate-600">Parent record (optional)</Label>
              <select
                id="dmr-parent"
                value={parentRecordId}
                onChange={(e) => setParentRecordId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Top level —</option>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>{r.title || `Record ${r.id.slice(0, 8)}`}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <DynamicCustomFields definitions={fieldDefinitions} values={customFieldValues} onChange={(k, v) => setCustomFieldValues((prev) => ({ ...prev, [k]: v }))} />
            </div>
          </div>
          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>Create record</Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : records.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No records yet. Create your first one above.</div>
            ) : (
              records
                .filter((r) => !r.parentRecordId)
                .map((r) => (
                  <RecordTreeRow
                    key={r.id}
                    record={r}
                    depth={0}
                    allRecords={records}
                    selectedId={selectedId}
                    onSelect={selectRecord}
                    onRemove={handleRemove}
                    branchName={branchName}
                  />
                ))
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {!selectedRecord || !definition ? (
              <div className="py-8 text-center text-sm text-slate-400">Select a record to change its status.</div>
            ) : (
              <>
                <h2 className="font-serif text-lg text-[#1E2A44] mb-1">{selectedRecord.title || `Record ${selectedRecord.id.slice(0, 8)}`}</h2>
                <p className="text-xs text-slate-400 mb-3">Current status: {selectedRecord.status}</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {definition.statuses
                    .filter((s) => s !== selectedRecord.status)
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => handleChangeStatus(selectedRecord, s)}
                        className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
                      >
                        Move to {s}
                      </button>
                    ))}
                </div>

                <h3 className="text-sm font-medium text-slate-700 mb-2">Members</h3>
                <form onSubmit={handleAddMember} className="space-y-2 mb-3">
                  <MemberSearchPicker members={members} value={newMemberId} onChange={setNewMemberId} />
                  <div className="flex gap-2">
                    <Input value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)} placeholder="role (e.g. leader, member)" className="flex-1" />
                    <Button type="submit" size="sm" style={{ backgroundColor: '#1E2A44' }} disabled={!newMemberId}>
                      Add
                    </Button>
                  </div>
                </form>

                {membershipsLoading ? (
                  <div className="py-4 text-center text-sm text-slate-400">Loading…</div>
                ) : recordMemberships.length === 0 ? (
                  <div className="py-4 text-center text-sm text-slate-400">No members yet.</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {recordMemberships.map((m) => (
                      <div key={m.id} className="flex items-center justify-between py-2">
                        <div>
                          <p className={`text-sm font-medium ${m.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{memberName(m.memberId)}</p>
                          <p className="text-xs text-slate-400">{m.role.replace(/_/g, ' ')}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(m.id)}
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

/** Renders one record plus its children recursively — a flat list when nothing has a parentRecordId, a tree once something does. */
function RecordTreeRow({
  record,
  depth,
  allRecords,
  selectedId,
  onSelect,
  onRemove,
  branchName,
}: {
  record: DynamicModuleRecord;
  depth: number;
  allRecords: DynamicModuleRecord[];
  selectedId: string | null;
  onSelect: (record: DynamicModuleRecord) => void;
  onRemove: (id: string) => void;
  branchName: (id: string | null) => string;
}) {
  const children = allRecords.filter((r) => r.parentRecordId === record.id);
  return (
    <>
      <div
        onClick={() => onSelect(record)}
        style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
        className={`flex items-center justify-between pr-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer ${
          selectedId === record.id ? 'bg-[#1E2A44]/5' : 'hover:bg-slate-50'
        }`}
      >
        <div>
          <p className="text-sm font-medium text-slate-800">{record.title || `Record ${record.id.slice(0, 8)}`}</p>
          <p className="text-xs text-slate-400">
            {record.status} · {branchName(record.branchId)}
            {record.attachedToEntityType ? ` · attached to ${record.attachedToEntityType}` : ''}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(record.id);
          }}
          className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
        >
          Remove
        </button>
      </div>
      {children.map((child) => (
        <RecordTreeRow
          key={child.id}
          record={child}
          depth={depth + 1}
          allRecords={allRecords}
          selectedId={selectedId}
          onSelect={onSelect}
          onRemove={onRemove}
          branchName={branchName}
        />
      ))}
    </>
  );
}
