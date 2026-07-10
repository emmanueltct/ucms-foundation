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
  DynamicModuleDefinition,
  DynamicModuleRecord,
  CustomFieldDefinition,
  Branch,
} from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { DynamicCustomFields } from '../../../../components/dynamic-custom-fields';

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
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      const [recordsRes, fieldsRes, branchesRes] = await Promise.all([
        dynamicModuleRecordsApi.list(TENANT_SLUG, defRes.data.id),
        customFieldDefinitionsApi.list(TENANT_SLUG, { entityType }),
        branchesApi.list(TENANT_SLUG),
      ]);
      if (recordsRes.success && recordsRes.data) setRecords(recordsRes.data);
      if (fieldsRes.success && fieldsRes.data) setFieldDefinitions(fieldsRes.data);
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
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
        title: title.trim() || undefined,
        attachedToEntityType: attachedToEntityType.trim() || undefined,
        attachedToEntityId: attachedToEntityId.trim() || undefined,
        branchId: branchId || undefined,
        customFields: customFieldValues,
      });
      if (res.success) {
        setTitle('');
        setAttachedToEntityType('');
        setAttachedToEntityId('');
        setBranchId('');
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
              <Input id="dmr-attach-type" value={attachedToEntityType} onChange={(e) => setAttachedToEntityType(e.target.value)} placeholder="branch, ministry, member…" />
            </div>
            <div>
              <Label htmlFor="dmr-attach-id" className="mb-1 text-slate-600">Attach to (record id, optional)</Label>
              <Input id="dmr-attach-id" value={attachedToEntityId} onChange={(e) => setAttachedToEntityId(e.target.value)} />
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
              records.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer ${
                    selectedId === r.id ? 'bg-[#1E2A44]/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.title || `Record ${r.id.slice(0, 8)}`}</p>
                    <p className="text-xs text-slate-400">
                      {r.status} · {branchName(r.branchId)}
                      {r.attachedToEntityType ? ` · attached to ${r.attachedToEntityType}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(r.id);
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
            {!selectedRecord || !definition ? (
              <div className="py-8 text-center text-sm text-slate-400">Select a record to change its status.</div>
            ) : (
              <>
                <h2 className="font-serif text-lg text-[#1E2A44] mb-1">{selectedRecord.title || `Record ${selectedRecord.id.slice(0, 8)}`}</h2>
                <p className="text-xs text-slate-400 mb-3">Current status: {selectedRecord.status}</p>
                <div className="flex flex-wrap gap-2">
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
