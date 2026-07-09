'use client';

// components/dynamic-custom-fields.tsx
// Renders whatever custom fields a tenant has defined for a given entity
// type (see docs/custom-fields) — the actual mechanism behind "every church
// can customize the system without modifying the source code." A form using
// this component never hard-codes which extra fields exist; it just renders
// whatever GET /custom-field-definitions?entityType=... returns, grouped
// into the sections an admin defined, filtered to whichever fields the
// current user's roles are allowed to see.

import { CustomFieldDefinition } from '../lib/api';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RichTextEditor } from './rich-text-editor';

interface LookupOption {
  id: string;
  label: string;
}

interface DynamicCustomFieldsProps {
  definitions: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (fieldKey: string, value: unknown) => void;
  /** Once the parent record exists, file/image/video/audio/signature fields become uploadable/downloadable. */
  entityId?: string;
  onUploadFile?: (fieldKey: string, file: File) => void | Promise<void>;
  onDownloadFile?: (fieldKey: string) => void | Promise<void>;
  /** The current user's role names, for filtering fields with a non-empty visibleToRoleNames. Omit to show everything (e.g. an admin-only settings context). */
  currentUserRoleNames?: string[];
  /** Candidate options for "lookup" fields, keyed by lookupEntityType (e.g. { member: [...] }). Falls back to a plain ID input when not supplied for a given entityType. */
  lookupOptionsByEntityType?: Record<string, LookupOption[]>;
}

const SELECT_CLASSNAME =
  'h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20';

export function DynamicCustomFields({
  definitions,
  values,
  onChange,
  entityId,
  onUploadFile,
  onDownloadFile,
  currentUserRoleNames,
  lookupOptionsByEntityType,
}: DynamicCustomFieldsProps) {
  const visibleDefinitions = definitions.filter((def) => {
    if (!currentUserRoleNames || def.visibleToRoleNames.length === 0) return true;
    return def.visibleToRoleNames.some((r) => currentUserRoleNames.includes(r));
  });
  if (visibleDefinitions.length === 0) return null;

  const sections: { name: string | null; fields: CustomFieldDefinition[] }[] = [];
  for (const def of visibleDefinitions) {
    const sectionName = def.section ?? null;
    let bucket = sections.find((s) => s.name === sectionName);
    if (!bucket) {
      bucket = { name: sectionName, fields: [] };
      sections.push(bucket);
    }
    bucket.fields.push(def);
  }

  return (
    <>
      {sections.map((bucket) => (
        <div key={bucket.name ?? '__general'} className={sections.length > 1 ? 'sm:col-span-2 lg:col-span-3 space-y-3' : 'contents'}>
          {bucket.name && (
            <p className="text-xs uppercase tracking-wide text-slate-400 font-medium sm:col-span-2 lg:col-span-3 pt-1">
              {bucket.name}
            </p>
          )}
          <div className={sections.length > 1 ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'contents'}>
            {bucket.fields.map((def) => (
              <CustomField
                key={def.id}
                def={def}
                value={values[def.fieldKey]}
                onChange={(v) => onChange(def.fieldKey, v)}
                entityId={entityId}
                onUploadFile={onUploadFile}
                onDownloadFile={onDownloadFile}
                lookupOptions={def.lookupEntityType ? lookupOptionsByEntityType?.[def.lookupEntityType] : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function CustomField({
  def,
  value,
  onChange,
  entityId,
  onUploadFile,
  onDownloadFile,
  lookupOptions,
}: {
  def: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  entityId?: string;
  onUploadFile?: (fieldKey: string, file: File) => void | Promise<void>;
  onDownloadFile?: (fieldKey: string) => void | Promise<void>;
  lookupOptions?: LookupOption[];
}) {
  const inputId = `custom-field-${def.fieldKey}`;
  const isFileLike = ['file', 'image', 'video', 'audio', 'signature'].includes(def.fieldType);

  return (
    <div>
      <Label htmlFor={inputId} className="mb-1 text-slate-600">
        {def.label}
        {def.isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </Label>

      {def.fieldType === 'text' && (
        <Input id={inputId} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}

      {def.fieldType === 'email' && (
        <Input id={inputId} type="email" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}

      {def.fieldType === 'phone' && (
        <Input id={inputId} type="tel" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}

      {def.fieldType === 'address' && (
        <textarea
          id={inputId}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
        />
      )}

      {def.fieldType === 'richtext' && (
        <RichTextEditor id={inputId} value={(value as string) ?? ''} onChange={onChange} />
      )}

      {def.fieldType === 'number' && (
        <Input
          id={inputId}
          type="number"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      )}

      {def.fieldType === 'date' && (
        <Input id={inputId} type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
      )}

      {def.fieldType === 'time' && (
        <Input id={inputId} type="time" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
      )}

      {def.fieldType === 'gps' && (
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Latitude"
            value={(value as { lat?: number })?.lat ?? ''}
            onChange={(e) =>
              onChange({ ...(value as object), lat: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
          <Input
            type="number"
            placeholder="Longitude"
            value={(value as { lng?: number })?.lng ?? ''}
            onChange={(e) =>
              onChange({ ...(value as object), lng: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
        </div>
      )}

      {def.fieldType === 'boolean' && (
        <select
          id={inputId}
          value={value === true ? 'true' : value === false ? 'false' : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')}
          className={SELECT_CLASSNAME}
        >
          <option value="">— Unset —</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      )}

      {def.fieldType === 'select' && (
        <select id={inputId} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} className={SELECT_CLASSNAME}>
          <option value="">— Select —</option>
          {(def.options ?? []).map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {def.fieldType === 'radio' && (
        <div className="flex flex-wrap gap-3 pt-1">
          {(def.options ?? []).map((opt) => (
            <label key={opt.key} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="radio" name={inputId} checked={value === opt.key} onChange={() => onChange(opt.key)} />
              {opt.label}
            </label>
          ))}
        </div>
      )}

      {def.fieldType === 'multiselect' && (
        <div className="flex flex-wrap gap-3 pt-1">
          {(def.options ?? []).map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt.key);
            return (
              <label key={opt.key} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    const current = Array.isArray(value) ? (value as string[]) : [];
                    onChange(e.target.checked ? [...current, opt.key] : current.filter((k) => k !== opt.key));
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      )}

      {def.fieldType === 'lookup' &&
        (lookupOptions ? (
          <select
            id={inputId}
            value={(value as { entityId?: string })?.entityId ?? ''}
            onChange={(e) => {
              const chosen = lookupOptions.find((o) => o.id === e.target.value);
              onChange(e.target.value ? { entityId: e.target.value, label: chosen?.label } : undefined);
            }}
            className={SELECT_CLASSNAME}
          >
            <option value="">— Select —</option>
            {lookupOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id={inputId}
            placeholder={`${def.lookupEntityType ?? 'record'} ID`}
            value={(value as { entityId?: string })?.entityId ?? ''}
            onChange={(e) => onChange(e.target.value ? { entityId: e.target.value } : undefined)}
          />
        ))}

      {isFileLike &&
        (!entityId ? (
          <p className="text-xs text-slate-400 italic">Save first, then upload here.</p>
        ) : (
          <FileLikeField def={def} value={value} onUploadFile={onUploadFile} onDownloadFile={onDownloadFile} inputId={inputId} />
        ))}
    </div>
  );
}

function FileLikeField({
  def,
  value,
  onUploadFile,
  onDownloadFile,
  inputId,
}: {
  def: CustomFieldDefinition;
  value: unknown;
  onUploadFile?: (fieldKey: string, file: File) => void | Promise<void>;
  onDownloadFile?: (fieldKey: string) => void | Promise<void>;
  inputId: string;
}) {
  const hasValue = Boolean(value && typeof value === 'object' && 'filename' in (value as Record<string, unknown>));
  const filename = hasValue ? (value as { filename: string }).filename : null;
  const accept = ({ image: 'image/*', video: 'video/*', audio: 'audio/*', signature: 'image/*' } as Record<string, string>)[
    def.fieldType
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {hasValue && (
        <button
          type="button"
          onClick={() => onDownloadFile?.(def.fieldKey)}
          className="text-xs font-medium px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-[#1E2A44]/30"
        >
          {def.fieldType === 'image' ? '🖼️' : def.fieldType === 'video' ? '🎬' : def.fieldType === 'audio' ? '🎵' : '📎'} {filename}
        </button>
      )}
      {def.fieldType === 'signature' ? (
        <SignaturePad onCapture={(file) => onUploadFile?.(def.fieldKey, file)} />
      ) : (
        <input
          id={inputId}
          type="file"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadFile?.(def.fieldKey, file);
            e.target.value = '';
          }}
          className="text-xs text-slate-500 file:mr-2 file:rounded-full file:border file:border-slate-200 file:bg-white file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-slate-600"
        />
      )}
    </div>
  );
}

function SignaturePad({ onCapture }: { onCapture: (file: File) => void }) {
  let canvasRef: HTMLCanvasElement | null = null;
  let drawing = false;

  function pos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const point = 'touches' in e ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    if (!canvasRef) return;
    drawing = true;
    const ctx = canvasRef.getContext('2d');
    const { x, y } = pos(e, canvasRef);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing || !canvasRef) return;
    const ctx = canvasRef.getContext('2d');
    const { x, y } = pos(e, canvasRef);
    if (ctx) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1E2A44';
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  function end() {
    drawing = false;
  }

  function clear() {
    const ctx = canvasRef?.getContext('2d');
    if (canvasRef && ctx) ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
  }

  function save() {
    if (!canvasRef) return;
    canvasRef.toBlob((blob) => {
      if (blob) onCapture(new File([blob], 'signature.png', { type: 'image/png' }));
    }, 'image/png');
  }

  return (
    <div className="flex flex-col gap-1.5">
      <canvas
        ref={(el) => {
          canvasRef = el;
        }}
        width={280}
        height={100}
        className="rounded-lg border border-slate-200 bg-white touch-none cursor-crosshair"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex gap-2">
        <button type="button" onClick={clear} className="text-xs font-medium px-2 py-1 rounded-full border border-slate-200 text-slate-600">
          Clear
        </button>
        <button type="button" onClick={save} className="text-xs font-medium px-2 py-1 rounded-full border border-slate-200 text-slate-600">
          Save signature
        </button>
      </div>
    </div>
  );
}
