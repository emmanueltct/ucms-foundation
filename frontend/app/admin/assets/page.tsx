'use client';

// app/admin/assets/page.tsx
// Lets a Church Administrator / Facilities Manager register assets under a
// tenant-configurable category (building, vehicle, equipment, ...) — each
// category renders its own custom fields dynamically (asset:{category} in
// the Custom Fields module), including file-upload fields for documents
// like insurance certificates or ownership deeds, once the asset exists.

import { useEffect, useState } from 'react';
import {
  assetsApi,
  branchesApi,
  configApi,
  customFieldDefinitionsApi,
  Asset,
  Branch,
  CustomFieldDefinition,
} from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { DynamicCustomFields } from '../../../components/dynamic-custom-fields';

const TENANT_SLUG = 'demo-church';

const ASSET_STATUSES = [
  { value: 'in_use', label: 'In use' },
  { value: 'in_storage', label: 'In storage' },
  { value: 'under_maintenance', label: 'Under maintenance' },
  { value: 'disposed', label: 'Disposed' },
  { value: 'lost', label: 'Lost' },
];

const STATUS_STYLES: Record<string, string> = {
  in_use: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  in_storage: 'text-slate-500 bg-slate-100 border-slate-200',
  under_maintenance: 'text-amber-700 bg-amber-50 border-amber-200',
  disposed: 'text-slate-400 bg-slate-50 border-slate-200 line-through',
  lost: 'text-red-700 bg-red-50 border-red-200',
};

export default function AssetsAdminPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<{ key: string; label: string }[]>([]);
  const [conditions, setConditions] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [assetCategory, setAssetCategory] = useState('');
  const [branchId, setBranchId] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [condition, setCondition] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [acquisitionCost, setAcquisitionCost] = useState('');
  const [notes, setNotes] = useState('');
  const [createFieldDefs, setCreateFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [createFieldValues, setCreateFieldValues] = useState<Record<string, unknown>>({});

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [detailFieldDefs, setDetailFieldDefs] = useState<CustomFieldDefinition[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [assetsRes, branchesRes, catRes, condRes] = await Promise.all([
        assetsApi.list(TENANT_SLUG, {
          assetCategory: categoryFilter || undefined,
          status: statusFilter || undefined,
          search: search || undefined,
        }),
        branchesApi.list(TENANT_SLUG),
        configApi.listByNamespace(TENANT_SLUG, 'asset_category'),
        configApi.listByNamespace(TENANT_SLUG, 'asset_condition'),
      ]);
      if (assetsRes.success && assetsRes.data) setAssets(assetsRes.data);
      else setError(assetsRes.error?.message ?? 'Could not load assets.');
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
      if (catRes.success && catRes.data) setCategories(catRes.data as { key: string; label: string }[]);
      if (condRes.success && condRes.data) setConditions(condRes.data as { key: string; label: string }[]);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, statusFilter, search]);

  // The create form's custom fields depend on whichever category is currently selected.
  useEffect(() => {
    if (!assetCategory) {
      setCreateFieldDefs([]);
      return;
    }
    customFieldDefinitionsApi.list(TENANT_SLUG, { entityType: `asset:${assetCategory}` }).then((res) => {
      if (res.success && res.data) setCreateFieldDefs(res.data);
    });
    setCreateFieldValues({});
  }, [assetCategory]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;

  useEffect(() => {
    if (!selectedAsset) {
      setDetailFieldDefs([]);
      return;
    }
    customFieldDefinitionsApi.list(TENANT_SLUG, { entityType: `asset:${selectedAsset.assetCategory}` }).then((res) => {
      if (res.success && res.data) setDetailFieldDefs(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAsset?.id, selectedAsset?.assetCategory]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !assetCategory) {
      setError('Name and category are required.');
      return;
    }
    try {
      const res = await assetsApi.create(TENANT_SLUG, {
        name: name.trim(),
        assetCategory,
        branchId: branchId || undefined,
        assetTag: assetTag.trim() || undefined,
        condition: condition || undefined,
        acquisitionDate: acquisitionDate || undefined,
        acquisitionCost: acquisitionCost ? Number(acquisitionCost) : undefined,
        notes: notes.trim() || undefined,
        customFields: Object.keys(createFieldValues).length > 0 ? createFieldValues : undefined,
      });
      if (res.success) {
        setName('');
        setAssetCategory('');
        setBranchId('');
        setAssetTag('');
        setCondition('');
        setAcquisitionDate('');
        setAcquisitionCost('');
        setNotes('');
        setCreateFieldValues({});
        load();
      } else {
        setError(res.error?.message ?? 'Could not register the asset.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemove(id: string) {
    try {
      const res = await assetsApi.remove(TENANT_SLUG, id);
      if (res.success) {
        if (selectedAssetId === id) setSelectedAssetId(null);
        load();
      } else {
        setError(res.error?.message ?? 'Could not remove the asset.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      const res = await assetsApi.update(TENANT_SLUG, id, { status });
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not update the status.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleDetailFieldChange(fieldKey: string, value: unknown) {
    if (!selectedAssetId) return;
    try {
      const res = await assetsApi.update(TENANT_SLUG, selectedAssetId, { customFields: { [fieldKey]: value } });
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not save that field.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleUploadFile(fieldKey: string, file: File) {
    if (!selectedAssetId) return;
    try {
      const res = await assetsApi.uploadDocument(TENANT_SLUG, selectedAssetId, fieldKey, file);
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not upload the file.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleDownloadFile(fieldKey: string) {
    if (!selectedAssetId) return;
    try {
      const res = await assetsApi.getDocumentDownloadUrl(TENANT_SLUG, selectedAssetId, fieldKey);
      if (res.success && res.data) window.open(res.data.url, '_blank');
      else setError(res.error?.message ?? 'Could not get a download link.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function categoryLabel(key: string) {
    return categories.find((c) => c.key === key)?.label ?? key.replace(/_/g, ' ');
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Asset &amp; Facility Management</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Assets</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Register buildings, vehicles, equipment, and more. Each category has its own
            fields — configured in Settings → Custom Fields — including document uploads
            where a category needs proof of purchase, insurance, or a title deed.
          </p>
        </header>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="asset-name" className="mb-1 text-slate-600">Name</Label>
              <Input id="asset-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Toyota Hiace — Youth Van" />
            </div>
            <div>
              <Label htmlFor="asset-category" className="mb-1 text-slate-600">Category</Label>
              <select
                id="asset-category"
                value={assetCategory}
                onChange={(e) => setAssetCategory(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Select a category —</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="asset-branch" className="mb-1 text-slate-600">Branch (optional)</Label>
              <select
                id="asset-branch"
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
              <Label htmlFor="asset-tag" className="mb-1 text-slate-600">Asset tag (optional)</Label>
              <Input id="asset-tag" value={assetTag} onChange={(e) => setAssetTag(e.target.value)} placeholder="VEH-0003" />
            </div>
            <div>
              <Label htmlFor="asset-condition" className="mb-1 text-slate-600">Condition (optional)</Label>
              <select
                id="asset-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Unspecified —</option>
                {conditions.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="asset-acq-date" className="mb-1 text-slate-600">Acquisition date (optional)</Label>
              <Input id="asset-acq-date" type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="asset-acq-cost" className="mb-1 text-slate-600">Acquisition cost (optional)</Label>
              <Input id="asset-acq-cost" type="number" min="0" value={acquisitionCost} onChange={(e) => setAcquisitionCost(e.target.value)} placeholder="18000000" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="asset-notes" className="mb-1 text-slate-600">Notes (optional)</Label>
              <Input id="asset-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {createFieldDefs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <DynamicCustomFields
                definitions={createFieldDefs}
                values={createFieldValues}
                onChange={(key, value) => setCreateFieldValues((prev) => ({ ...prev, [key]: value }))}
              />
            </div>
          )}

          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>Register asset</Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
          >
            <option value="">All statuses</option>
            {ASSET_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or tag…"
            className="w-48"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : assets.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No assets yet. Register your first one above.</div>
            ) : (
              assets.map((a) => (
                <div
                  key={a.id}
                  onClick={() => setSelectedAssetId(a.id)}
                  className={`flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer ${
                    selectedAssetId === a.id ? 'bg-[#1E2A44]/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.name}</p>
                    <p className="text-xs text-slate-400">
                      {categoryLabel(a.assetCategory)} {a.assetTag ? `· ${a.assetTag}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[a.status]}`}>
                    {a.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {!selectedAsset ? (
              <div className="py-8 text-center text-sm text-slate-400">Select an asset to see its details.</div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-serif text-lg text-[#1E2A44]">{selectedAsset.name}</h2>
                    <p className="text-xs text-slate-400">{categoryLabel(selectedAsset.assetCategory)}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(selectedAsset.id)}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <Label className="mb-1 text-slate-600">Status</Label>
                    <select
                      value={selectedAsset.status}
                      onChange={(e) => handleStatusChange(selectedAsset.id, e.target.value)}
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                    >
                      {ASSET_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  {selectedAsset.acquisitionCost && (
                    <div>
                      <Label className="mb-1 text-slate-600">Acquisition cost</Label>
                      <p className="text-sm text-slate-800 pt-1.5">
                        {selectedAsset.acquisitionCost} {selectedAsset.currency}
                      </p>
                    </div>
                  )}
                </div>

                {detailFieldDefs.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <p className="text-xs uppercase tracking-wide text-slate-400 font-medium">
                      {categoryLabel(selectedAsset.assetCategory)} details
                    </p>
                    <DynamicCustomFields
                      definitions={detailFieldDefs}
                      values={selectedAsset.customFields}
                      onChange={handleDetailFieldChange}
                      entityId={selectedAsset.id}
                      onUploadFile={handleUploadFile}
                      onDownloadFile={handleDownloadFile}
                    />
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
