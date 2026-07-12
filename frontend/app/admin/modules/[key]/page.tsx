'use client';

// app/admin/modules/[key]/page.tsx
// The generic record page every admin-defined Dynamic Module renders
// through — one page serving every module built on the Dynamic Module
// Builder (app/admin/settings/dynamic-modules), the same way
// DynamicCustomFields already renders any entity's fields from data alone.
//
// The create form shows only the fields the admin actually defined for this
// module — no generic title/attach-to/branch/parent-record inputs. Those
// structural fields still exist on the backend, but they're no longer
// user-set here; instead the submissions table shows each record's "level"
// (branch/department/ministry) resolved live from its creator's own current
// assignment (`DynamicModuleRecord.creatorContext`, backed by
// `DynamicModuleRecordsService.resolveCreatorContextsFor`).

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  dynamicModuleDefinitionsApi,
  dynamicModuleRecordsApi,
  customFieldDefinitionsApi,
  entityMembershipsApi,
  membersApi,
  isAccessDeniedResponse,
  DynamicModuleDefinition,
  DynamicModuleRecord,
  CustomFieldDefinition,
  Member,
  EntityMembership,
} from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { DynamicCustomFields } from '../../../../components/dynamic-custom-fields';
import { MemberSearchPicker } from '../../../../components/member-search-picker';
import { AccessDenied } from '../../../../components/access-denied';

const TENANT_SLUG = 'demo-church';

export default function DynamicModuleRecordsPage() {
  const params = useParams<{ key: string }>();
  const moduleKey = params.key;

  const [definition, setDefinition] = useState<DynamicModuleDefinition | null>(null);
  const [records, setRecords] = useState<DynamicModuleRecord[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

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
    setAccessDenied(false);
    try {
      const defRes = await dynamicModuleDefinitionsApi.getByKey(TENANT_SLUG, moduleKey);
      if (!defRes.success || !defRes.data) {
        setNotFound(true);
        return;
      }
      setDefinition(defRes.data);

      const entityType = `dynamicmodule:${defRes.data.id}`;
      const [recordsRes, fieldsRes, membersRes] = await Promise.all([
        dynamicModuleRecordsApi.list(TENANT_SLUG, defRes.data.id),
        customFieldDefinitionsApi.list(TENANT_SLUG, { entityType }),
        membersApi.list(TENANT_SLUG, {}),
      ]);
      if (isAccessDeniedResponse(recordsRes)) {
        setAccessDenied(true);
        return;
      }
      if (recordsRes.success && recordsRes.data) setRecords(recordsRes.data);
      if (fieldsRes.success && fieldsRes.data) setFieldDefinitions(fieldsRes.data);
      if (membersRes.success && membersRes.data) setMembers(membersRes.data);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMemberships(record: DynamicModuleRecord) {
    if (!definition || !definition.allowMemberAttachment) return;
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!definition) return;
    try {
      const res = await dynamicModuleRecordsApi.create(TENANT_SLUG, definition.id, {
        customFields: customFieldValues,
      });
      if (res.success) {
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

  /** "The level for the user who filled it" — ministry/department shown alongside branch, since a submitter's ministry or department doesn't replace knowing their branch too. Falls back to "Church-wide" for a creator with none of these (or no known creator). */
  function levelLabel(record: DynamicModuleRecord): string {
    const ctx = record.creatorContext;
    if (!ctx) return 'Church-wide';
    const parts = [ctx.ministryName, ctx.departmentName, ctx.branchName].filter((p): p is string => !!p);
    return parts.length > 0 ? parts.join(' · ') : 'Church-wide';
  }

  /** No generic "title" is collected anymore (the create form only asks for admin-defined fields), so identify a record by the actual values filled in — in the order the admin defined those fields — rather than a meaningless id fragment. Used only for the detail panel's single-line heading; the table itself gives every field its own column (see fieldDisplayValue). */
  function recordLabel(record: DynamicModuleRecord): string {
    if (record.title) return record.title;
    const parts = sortedFieldDefinitions
      .map((def) => record.customFields[def.fieldKey])
      .filter((v) => v !== undefined && v !== null && v !== '')
      .map((v) => String(v));
    return parts.length > 0 ? parts.join(' · ') : `Record ${record.id.slice(0, 8)}`;
  }

  /** Renders one custom field's value for its own table column — a plain scalar as text, an array (multiselect) joined, a boolean as Yes/No, an uploaded file by its filename, rich text stripped of markup and truncated. */
  function fieldDisplayValue(def: CustomFieldDefinition, value: unknown): string {
    if (value === undefined || value === null || value === '') return '—';
    if (Array.isArray(value)) return value.map(String).join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (def.fieldType === 'richtext' && typeof value === 'string') {
      const stripped = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return stripped.length > 60 ? `${stripped.slice(0, 60)}…` : stripped;
    }
    if (typeof value === 'object') {
      const file = value as { filename?: string };
      if (file.filename) return file.filename;
      return JSON.stringify(value);
    }
    return String(value);
  }

  const sortedFieldDefinitions = [...fieldDefinitions].sort((a, b) => a.sortOrder - b.sortOrder);

  if (accessDenied) return <AccessDenied />;

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
          <DynamicCustomFields definitions={fieldDefinitions} values={customFieldValues} onChange={(k, v) => setCustomFieldValues((prev) => ({ ...prev, [k]: v }))} />
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                      {sortedFieldDefinitions.map((def) => (
                        <th key={def.id} className="px-4 py-3 font-medium whitespace-nowrap">{def.label}</th>
                      ))}
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Level</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => selectRecord(r)}
                        className={`cursor-pointer border-b border-slate-50 last:border-0 ${
                          selectedId === r.id ? 'bg-[#1E2A44]/5' : 'hover:bg-slate-50'
                        }`}
                      >
                        {sortedFieldDefinitions.map((def) => (
                          <td key={def.id} className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                            {fieldDisplayValue(def, r.customFields[def.fieldKey])}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-slate-600">{r.status}</td>
                        <td className="px-4 py-3 text-slate-600">{levelLabel(r)}</td>
                        <td className="px-4 py-3 text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(r.id);
                            }}
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

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {!selectedRecord || !definition ? (
              <div className="py-8 text-center text-sm text-slate-400">Select a record to change its status.</div>
            ) : (
              <>
                <h2 className="font-serif text-lg text-[#1E2A44] mb-1">{recordLabel(selectedRecord)}</h2>
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

                {definition.allowMemberAttachment && (
                  <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
