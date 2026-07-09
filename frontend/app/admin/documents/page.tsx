'use client';

// app/admin/documents/page.tsx
// Lets a Church Administrator upload, categorize, and retrieve documents —
// policies, meeting minutes, forms, certificates, sermon notes, legal
// paperwork — all stored through the same object store the rest of the
// platform uses. Images/video/audio preview inline; every file replacement
// keeps the superseded file as a downloadable version instead of discarding it.

import { useEffect, useRef, useState } from 'react';
import { documentsApi, branchesApi, configApi, ChurchDocument, DocumentVersion, Branch } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const TENANT_SLUG = 'demo-church';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function previewKind(contentType: string): 'image' | 'video' | 'audio' | null {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  return null;
}

/** Expand-in-place preview + version history for one document — fetches its signed URL/versions lazily, only once expanded. */
function DocumentDetail({ doc }: { doc: ChurchDocument }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const kind = previewKind(doc.contentType);
        const [downloadRes, versionsRes] = await Promise.all([
          kind ? documentsApi.getDownloadUrl(TENANT_SLUG, doc.id) : Promise.resolve(null),
          documentsApi.listVersions(TENANT_SLUG, doc.id),
        ]);
        if (cancelled) return;
        if (downloadRes) {
          if (downloadRes.success && downloadRes.data) setPreviewUrl(downloadRes.data.url);
        }
        if (versionsRes.success && versionsRes.data) setVersions(versionsRes.data);
        else if (!versionsRes.success) setError(versionsRes.error?.message ?? 'Could not load version history.');
      } catch {
        if (!cancelled) setError('Could not reach the server. Check the API is running.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [doc.id, doc.contentType]);

  async function handleDownloadVersion(versionId: string) {
    const res = await documentsApi.getVersionDownloadUrl(TENANT_SLUG, doc.id, versionId);
    if (res.success && res.data) window.open(res.data.url, '_blank');
  }

  const kind = previewKind(doc.contentType);

  return (
    <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-50 last:border-0">
      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Preview</p>
            {!kind || !previewUrl ? (
              <p className="text-xs text-slate-400">No inline preview for this file type — use Download.</p>
            ) : kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={doc.fileName} className="max-h-48 rounded-lg border border-slate-200" />
            ) : kind === 'video' ? (
              <video src={previewUrl} controls className="max-h-48 rounded-lg border border-slate-200" />
            ) : (
              <audio src={previewUrl} controls className="w-full" />
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Version history</p>
            {versions.length === 0 ? (
              <p className="text-xs text-slate-400">No previous versions — the file hasn&rsquo;t been replaced yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 truncate">
                      {v.fileName} ({formatSize(v.fileSize)}) · {v.createdAt.slice(0, 10)}
                    </span>
                    <button
                      onClick={() => handleDownloadVersion(v.id)}
                      className="ml-2 shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-200 text-slate-600 hover:border-[#1E2A44]/40"
                    >
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentsAdminPage() {
  const [documents, setDocuments] = useState<ChurchDocument[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [branchId, setBranchId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [batchMode, setBatchMode] = useState(false);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [docsRes, branchesRes, catRes] = await Promise.all([
        documentsApi.list(TENANT_SLUG, { category: categoryFilter || undefined, search: search || undefined }),
        branchesApi.list(TENANT_SLUG),
        configApi.listByNamespace(TENANT_SLUG, 'document_category'),
      ]);
      if (docsRes.success && docsRes.data) setDocuments(docsRes.data);
      else setError(docsRes.error?.message ?? 'Could not load documents.');
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
      if (catRes.success && catRes.data) setCategories(catRes.data as { key: string; label: string }[]);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, search]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!category) {
      setError('Category is required.');
      return;
    }
    setUploading(true);
    try {
      if (batchMode) {
        const files = batchFileInputRef.current?.files;
        if (!files || files.length === 0) {
          setError('Select at least one file.');
          return;
        }
        const res = await documentsApi.createBatch(TENANT_SLUG, {
          category,
          titlePrefix: title.trim() || undefined,
          description: description.trim() || undefined,
          branchId: branchId || undefined,
          files: Array.from(files),
        });
        if (res.success) {
          setTitle('');
          setCategory('');
          setDescription('');
          setBranchId('');
          if (batchFileInputRef.current) batchFileInputRef.current.value = '';
          load();
        } else {
          setError(res.error?.message ?? 'Could not upload the documents.');
        }
      } else {
        const file = fileInputRef.current?.files?.[0];
        if (!title.trim() || !file) {
          setError('Title and a file are required.');
          return;
        }
        const res = await documentsApi.create(TENANT_SLUG, {
          title: title.trim(),
          category,
          description: description.trim() || undefined,
          branchId: branchId || undefined,
          file,
        });
        if (res.success) {
          setTitle('');
          setCategory('');
          setDescription('');
          setBranchId('');
          if (fileInputRef.current) fileInputRef.current.value = '';
          load();
        } else {
          setError(res.error?.message ?? 'Could not upload the document.');
        }
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(id: string) {
    try {
      const res = await documentsApi.getDownloadUrl(TENANT_SLUG, id);
      if (res.success && res.data) window.open(res.data.url, '_blank');
      else setError(res.error?.message ?? 'Could not get a download link.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemove(id: string) {
    try {
      const res = await documentsApi.remove(TENANT_SLUG, id);
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not remove the document.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function triggerReplace(id: string) {
    setReplacingId(id);
    replaceInputRef.current?.click();
  }

  async function handleReplaceFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !replacingId) return;
    try {
      const res = await documentsApi.replaceFile(TENANT_SLUG, replacingId, file);
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not replace the file.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setReplacingId(null);
    }
  }

  function categoryLabel(key: string) {
    return categories.find((c) => c.key === key)?.label ?? key.replace(/_/g, ' ');
  }

  function branchName(id: string | null) {
    if (!id) return 'Church-wide';
    return branches.find((b) => b.id === id)?.name ?? 'Church-wide';
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Document Management</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Documents</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Policies, meeting minutes, forms, certificates, sermon notes, legal paperwork —
            one categorized, searchable store instead of scattered inboxes and drives. Images,
            video, and audio preview inline; replacing a file keeps the old one as a version.
          </p>
        </header>

        <form onSubmit={handleUpload} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBatchMode(false)}
              className={`text-xs font-medium px-3 py-1 rounded-full border ${
                !batchMode ? 'bg-[#1E2A44] text-white border-[#1E2A44]' : 'border-slate-200 text-slate-600'
              }`}
            >
              Single file
            </button>
            <button
              type="button"
              onClick={() => setBatchMode(true)}
              className={`text-xs font-medium px-3 py-1 rounded-full border ${
                batchMode ? 'bg-[#1E2A44] text-white border-[#1E2A44]' : 'border-slate-200 text-slate-600'
              }`}
            >
              Multiple files
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="doc-title" className="mb-1 text-slate-600">
                {batchMode ? 'Title prefix (optional)' : 'Title'}
              </Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={batchMode ? 'Board Meeting Photos' : 'Board Meeting Minutes — March 2026'}
              />
            </div>
            <div>
              <Label htmlFor="doc-category" className="mb-1 text-slate-600">Category</Label>
              <select
                id="doc-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Select a category —</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="doc-branch" className="mb-1 text-slate-600">Branch (optional)</Label>
              <select
                id="doc-branch"
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
            <div className="sm:col-span-2">
              <Label htmlFor="doc-description" className="mb-1 text-slate-600">Description (optional)</Label>
              <Input id="doc-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="doc-file" className="mb-1 text-slate-600">{batchMode ? 'Files' : 'File'}</Label>
              {batchMode ? (
                <input
                  id="doc-file"
                  ref={batchFileInputRef}
                  type="file"
                  multiple
                  className="text-xs text-slate-500 file:mr-2 file:rounded-full file:border file:border-slate-200 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-slate-600"
                />
              ) : (
                <input
                  id="doc-file"
                  ref={fileInputRef}
                  type="file"
                  className="text-xs text-slate-500 file:mr-2 file:rounded-full file:border file:border-slate-200 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-slate-600"
                />
              )}
            </div>
          </div>
          <Button type="submit" disabled={uploading} style={{ backgroundColor: '#1E2A44' }}>
            {uploading ? 'Uploading…' : batchMode ? 'Upload documents' : 'Upload document'}
          </Button>
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
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or description…" className="w-56" />
        </div>

        <input ref={replaceInputRef} type="file" className="hidden" onChange={handleReplaceFileSelected} />

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : documents.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No documents yet. Upload your first one above.</div>
          ) : (
            documents.map((d) => (
              <div key={d.id}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0">
                  <div className="min-w-0 cursor-pointer" onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}>
                    <p className="text-sm font-medium text-slate-800 truncate">{d.title}</p>
                    <p className="text-xs text-slate-400">
                      {categoryLabel(d.category)} · {branchName(d.branchId)} · {d.fileName} ({formatSize(d.fileSize)})
                    </p>
                    {d.description && <p className="text-xs text-slate-500 mt-0.5">{d.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                      className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-[#1E2A44]/30"
                    >
                      {expandedId === d.id ? 'Hide' : 'Preview & versions'}
                    </button>
                    <button
                      onClick={() => handleDownload(d.id)}
                      className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-[#1E2A44]/30"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => triggerReplace(d.id)}
                      className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-[#1E2A44]/30"
                    >
                      Replace file
                    </button>
                    <button
                      onClick={() => handleRemove(d.id)}
                      className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {expandedId === d.id && <DocumentDetail doc={d} />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
