'use client';

// app/admin/settings/custom-fields/page.tsx
// Where a Church Administrator shapes the platform to their own church:
// define extra fields per entity (Member, Contribution, ...), grouped into
// sections, ordered, optionally restricted to certain roles, with no code
// change. This is the control panel for the Custom Fields module — see
// docs/custom-fields/business-analysis.md.

import { useEffect, useState } from 'react';
import { customFieldDefinitionsApi, configApi, rolesApi, CustomFieldDefinition, CustomFieldOption, CustomFieldType, Role } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';

const TENANT_SLUG = 'demo-church';

const BASE_ENTITY_TYPES = [
  { value: 'member', label: 'Member' },
  { value: 'contribution', label: 'Contribution' },
  { value: 'attendance_record', label: 'Attendance Record' },
  { value: 'ministry', label: 'Ministry' },
];

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'richtext', label: 'Rich Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Radio buttons' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'address', label: 'Address' },
  { value: 'gps', label: 'GPS Location' },
  { value: 'file', label: 'File upload' },
  { value: 'image', label: 'Image upload' },
  { value: 'video', label: 'Video upload' },
  { value: 'audio', label: 'Audio upload' },
  { value: 'signature', label: 'Digital signature' },
  { value: 'lookup', label: 'Lookup (link another record)' },
];

const OPTION_TYPES: CustomFieldType[] = ['select', 'radio', 'multiselect'];

export default function CustomFieldsSettingsPage() {
  // Asset categories are themselves tenant-configurable ConfigItems (see the
  // Asset & Facility Management module), so each one gets its own entry here
  // as "asset:{category}" — the same free-string entityType composition the
  // Assets backend module uses, rather than a fixed pill list.
  const [assetEntityTypes, setAssetEntityTypes] = useState<{ value: string; label: string }[]>([]);
  const ENTITY_TYPES = [...BASE_ENTITY_TYPES, ...assetEntityTypes];

  const [entityType, setEntityType] = useState(BASE_ENTITY_TYPES[0].value);
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [isRequired, setIsRequired] = useState(false);
  const [section, setSection] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [optionsText, setOptionsText] = useState(''); // "key:Label, key2:Label 2"
  const [lookupEntityType, setLookupEntityType] = useState('');
  const [visibleToRoleNames, setVisibleToRoleNames] = useState<string[]>([]);
  const [minLength, setMinLength] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');

  useEffect(() => {
    configApi.listByNamespace(TENANT_SLUG, 'asset_category').then((res) => {
      if (res.success && res.data) {
        setAssetEntityTypes(
          (res.data as { key: string; label: string }[]).map((c) => ({ value: `asset:${c.key}`, label: `Asset: ${c.label}` })),
        );
      }
    });
    rolesApi.list(TENANT_SLUG).then((res) => {
      if (res.success && res.data) setRoles(res.data);
    });
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await customFieldDefinitionsApi.list(TENANT_SLUG, { entityType, includeInactive: true });
      if (res.success && res.data) setDefinitions(res.data);
      else setError(res.error?.message ?? 'Could not load custom fields.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  function slugify(text: string) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function parseOptions(): CustomFieldOption[] | undefined {
    if (!OPTION_TYPES.includes(fieldType)) return undefined;
    return optionsText
      .split(',')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [key, ...rest] = pair.split(':');
        const optLabel = rest.join(':').trim();
        return { key: slugify(key), label: optLabel || key.trim() };
      });
  }

  function resetForm() {
    setLabel('');
    setFieldKey('');
    setOptionsText('');
    setIsRequired(false);
    setSection('');
    setSortOrder('0');
    setLookupEntityType('');
    setVisibleToRoleNames([]);
    setMinLength('');
    setMaxLength('');
    setMinValue('');
    setMaxValue('');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    const key = fieldKey.trim() ? slugify(fieldKey) : slugify(label);
    const options = parseOptions();
    if (OPTION_TYPES.includes(fieldType) && (!options || options.length === 0)) {
      setError(`A "${FIELD_TYPES.find((t) => t.value === fieldType)?.label}" field needs at least one option (format: key:Label, key2:Label 2).`);
      return;
    }
    if (fieldType === 'lookup' && !lookupEntityType.trim()) {
      setError('A lookup field needs to know which entity type it points to (e.g. "member").');
      return;
    }

    const validationRules =
      minLength || maxLength || minValue || maxValue
        ? {
            minLength: minLength ? Number(minLength) : undefined,
            maxLength: maxLength ? Number(maxLength) : undefined,
            min: minValue ? Number(minValue) : undefined,
            max: maxValue ? Number(maxValue) : undefined,
          }
        : undefined;

    try {
      const res = await customFieldDefinitionsApi.create(TENANT_SLUG, {
        entityType,
        fieldKey: key,
        label: label.trim(),
        fieldType,
        options,
        isRequired,
        section: section.trim() || undefined,
        sortOrder: sortOrder ? Number(sortOrder) : undefined,
        lookupEntityType: fieldType === 'lookup' ? lookupEntityType.trim() : undefined,
        visibleToRoleNames: visibleToRoleNames.length > 0 ? visibleToRoleNames : undefined,
        validationRules,
      });
      if (res.success) {
        resetForm();
        load();
      } else {
        setError(res.error?.message ?? 'Could not create the field.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleToggle(def: CustomFieldDefinition) {
    try {
      const res = def.isActive
        ? await customFieldDefinitionsApi.deactivate(TENANT_SLUG, def.id)
        : await customFieldDefinitionsApi.reactivate(TENANT_SLUG, def.id);
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not update the field.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  const needsOptions = OPTION_TYPES.includes(fieldType);
  const needsLookupEntityType = fieldType === 'lookup';
  const supportsStringRules = ['text', 'richtext', 'phone', 'address'].includes(fieldType);
  const supportsNumberRules = fieldType === 'number';

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Settings</p>
        <h1 className="font-serif text-3xl text-[#1E2A44]">Custom Fields</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-xl">
          Add fields your church actually needs — a Confirmation Date, a Spiritual Gift, a
          baptism location, anything — to any form below. Group them into sections, order them,
          restrict them to certain roles, and add validation. No code change, no waiting on us:
          define it here and it shows up immediately.
        </p>
      </header>

      <div className="flex gap-2 mb-6 flex-wrap">
        {ENTITY_TYPES.map((et) => (
          <button
            key={et.value}
            onClick={() => setEntityType(et.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              et.value === entityType ? 'bg-[#1E2A44] text-white border-[#1E2A44]' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {et.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label htmlFor="cf-label" className="mb-1 text-slate-600">
              Field label
            </Label>
            <Input id="cf-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Confirmation Date" />
          </div>
          <div>
            <Label htmlFor="cf-key" className="mb-1 text-slate-600">
              Key (optional)
            </Label>
            <Input id="cf-key" value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder="auto from label" />
          </div>
          <div>
            <Label htmlFor="cf-type" className="mb-1 text-slate-600">
              Type
            </Label>
            <select
              id="cf-type"
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
              className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>
                  {ft.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
              Required
            </label>
          </div>
          <div>
            <Label htmlFor="cf-section" className="mb-1 text-slate-600">
              Section (optional)
            </Label>
            <Input id="cf-section" value={section} onChange={(e) => setSection(e.target.value)} placeholder="Contact Info" />
          </div>
          <div>
            <Label htmlFor="cf-order" className="mb-1 text-slate-600">
              Sort order
            </Label>
            <Input id="cf-order" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
          {needsLookupEntityType && (
            <div>
              <Label htmlFor="cf-lookup" className="mb-1 text-slate-600">
                Links to entity type
              </Label>
              <Input id="cf-lookup" value={lookupEntityType} onChange={(e) => setLookupEntityType(e.target.value)} placeholder="member" />
            </div>
          )}
        </div>

        {needsOptions && (
          <div>
            <Label htmlFor="cf-options" className="mb-1 text-slate-600">
              Options (format: key:Label, key2:Label 2)
            </Label>
            <Input
              id="cf-options"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="teaching:Teaching, worship:Worship"
            />
          </div>
        )}

        {supportsStringRules && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 text-slate-600">Min length (optional)</Label>
              <Input type="number" value={minLength} onChange={(e) => setMinLength(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 text-slate-600">Max length (optional)</Label>
              <Input type="number" value={maxLength} onChange={(e) => setMaxLength(e.target.value)} />
            </div>
          </div>
        )}

        {supportsNumberRules && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 text-slate-600">Minimum value (optional)</Label>
              <Input type="number" value={minValue} onChange={(e) => setMinValue(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 text-slate-600">Maximum value (optional)</Label>
              <Input type="number" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} />
            </div>
          </div>
        )}

        {roles.length > 0 && (
          <div>
            <Label className="mb-1.5 text-slate-600">Visible to roles (leave empty for everyone)</Label>
            <div className="flex flex-wrap gap-3">
              {roles.map((r) => (
                <label key={r.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={visibleToRoleNames.includes(r.name)}
                    onChange={(e) =>
                      setVisibleToRoleNames((prev) =>
                        e.target.checked ? [...prev, r.name] : prev.filter((n) => n !== r.name),
                      )
                    }
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>
          Add field
        </Button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : definitions.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            No custom fields defined for {ENTITY_TYPES.find((e) => e.value === entityType)?.label} yet.
          </div>
        ) : (
          definitions.map((def) => (
            <div key={def.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0">
              <div>
                <p className={`text-sm font-medium ${def.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                  {def.label} {def.isRequired && <span className="text-red-500">*</span>}
                </p>
                <p className="text-xs text-slate-400">
                  {def.fieldKey} · {FIELD_TYPES.find((t) => t.value === def.fieldType)?.label}
                  {def.section ? ` · Section: ${def.section}` : ''}
                  {def.options && def.options.length > 0 ? ` · ${def.options.map((o) => o.label).join(', ')}` : ''}
                  {def.visibleToRoleNames.length > 0 ? ` · Visible to: ${def.visibleToRoleNames.join(', ')}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleToggle(def)}
                className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-300"
              >
                {def.isActive ? 'Retire' : 'Restore'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
