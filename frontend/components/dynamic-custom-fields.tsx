'use client';

// components/dynamic-custom-fields.tsx
// Renders whatever custom fields a tenant has defined for a given entity
// type (see docs/custom-fields) — the actual mechanism behind "every church
// can customize the system without modifying the source code." A form using
// this component never hard-codes which extra fields exist; it just renders
// whatever GET /custom-field-definitions?entityType=... returns.

import { CustomFieldDefinition } from '../lib/api';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface DynamicCustomFieldsProps {
  definitions: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (fieldKey: string, value: unknown) => void;
}

export function DynamicCustomFields({ definitions, values, onChange }: DynamicCustomFieldsProps) {
  if (definitions.length === 0) return null;

  return (
    <>
      {definitions.map((def) => {
        const inputId = `custom-field-${def.fieldKey}`;
        const value = values[def.fieldKey];

        return (
          <div key={def.id}>
            <Label htmlFor={inputId} className="mb-1 text-slate-600">
              {def.label}
              {def.isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            {def.fieldType === 'text' && (
              <Input
                id={inputId}
                value={(value as string) ?? ''}
                onChange={(e) => onChange(def.fieldKey, e.target.value)}
              />
            )}
            {def.fieldType === 'number' && (
              <Input
                id={inputId}
                type="number"
                value={value === undefined || value === null ? '' : String(value)}
                onChange={(e) => onChange(def.fieldKey, e.target.value === '' ? undefined : Number(e.target.value))}
              />
            )}
            {def.fieldType === 'date' && (
              <Input
                id={inputId}
                type="date"
                value={(value as string) ?? ''}
                onChange={(e) => onChange(def.fieldKey, e.target.value || undefined)}
              />
            )}
            {def.fieldType === 'boolean' && (
              <select
                id={inputId}
                value={value === true ? 'true' : value === false ? 'false' : ''}
                onChange={(e) => onChange(def.fieldKey, e.target.value === '' ? undefined : e.target.value === 'true')}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Unset —</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            )}
            {def.fieldType === 'select' && (
              <select
                id={inputId}
                value={(value as string) ?? ''}
                onChange={(e) => onChange(def.fieldKey, e.target.value || undefined)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Select —</option>
                {(def.options ?? []).map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </>
  );
}
