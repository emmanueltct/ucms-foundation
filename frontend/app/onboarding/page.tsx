'use client';

// app/onboarding/page.tsx
// First-run wizard for a newly provisioned church. The organizational
// hierarchy is never fixed (see docs/church-hierarchy/business-analysis.md)
// — a church names its own levels (Diocese/Parish/Cell, or whatever fits),
// creates its top-level institution, and can keep adding sub-levels right
// here in the wizard, the same way it can later from the Branches page.
// Nothing here is a persisted state machine: every step is a plain call to
// an endpoint that already exists (config items, branch creation, the
// idempotent onboarding-complete step) — see design decision #7 in the
// root README.

import { useEffect, useState } from 'react';
import { tenantApi, configApi, branchesApi, TenantProfile, Branch } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

const TENANT_SLUG = 'demo-church'; // in production this comes from the resolved workspace/domain

const STEPS = ['Welcome', 'Levels', 'Headquarters', 'Structure', 'Finish'] as const;

interface BranchTypeOption {
  key: string;
  label: string;
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [branchTypes, setBranchTypes] = useState<BranchTypeOption[]>([]);
  const [newLevelLabel, setNewLevelLabel] = useState('');

  const [headquartersName, setHeadquartersName] = useState('');
  const [headquartersType, setHeadquartersType] = useState('');
  const [hqBranch, setHqBranch] = useState<Branch | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [childName, setChildName] = useState('');
  const [childType, setChildType] = useState('');
  const [childParentId, setChildParentId] = useState('');

  useEffect(() => {
    tenantApi
      .getProfile(TENANT_SLUG)
      .then((res) => {
        if (res.success && res.data) {
          setProfile(res.data);
          setHeadquartersName((current) => current || res.data!.name);
        } else {
          setError(res.error?.message ?? 'Could not load your church profile.');
        }
      })
      .catch(() => setError('Could not reach the server. Check the API is running.'));

    configApi.listByNamespace(TENANT_SLUG, 'branch_type').then((res) => {
      if (res.success && res.data) {
        const options = res.data as BranchTypeOption[];
        setBranchTypes(options);
        setHeadquartersType((current) => current || options[0]?.key || 'headquarters');
      }
    });
  }, []);

  function slugify(text: string) {
    return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  async function handleAddLevel(e: React.FormEvent) {
    e.preventDefault();
    if (!newLevelLabel.trim()) return;
    const key = slugify(newLevelLabel);
    setError(null);
    try {
      const res = await configApi.create(TENANT_SLUG, {
        namespace: 'branch_type',
        key,
        label: newLevelLabel.trim(),
        value: {},
      });
      if (res.success) {
        setBranchTypes((prev) => [...prev, { key, label: newLevelLabel.trim() }]);
        setNewLevelLabel('');
      } else {
        setError(res.error?.message ?? 'Could not add that level.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleCreateHeadquarters() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await tenantApi.completeOnboarding(TENANT_SLUG, {
        headquartersName: headquartersName.trim() || undefined,
        headquartersType: headquartersType || undefined,
      });
      if (!res.success) {
        setError(res.error?.message ?? 'Could not complete onboarding.');
        return;
      }
      const branchesRes = await branchesApi.list(TENANT_SLUG);
      if (branchesRes.success && branchesRes.data) {
        setBranches(branchesRes.data);
        const hq = branchesRes.data.find((b) => b.isHeadquarters) ?? branchesRes.data[0] ?? null;
        setHqBranch(hq);
        setChildParentId(hq?.id ?? '');
        setChildType(branchTypes.find((t) => t.key !== headquartersType)?.key ?? headquartersType);
      }
      setStep(3);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddChildBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!childName.trim() || !childParentId) return;
    setError(null);
    try {
      const res = await branchesApi.create(TENANT_SLUG, {
        name: childName.trim(),
        branchType: childType || undefined,
        parentBranchId: childParentId,
      });
      if (res.success && res.data) {
        setBranches((prev) => [...prev, res.data!]);
        setChildName('');
      } else {
        setError(res.error?.message ?? 'Could not add that branch.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function branchLabel(b: Branch): string {
    const type = branchTypes.find((t) => t.key === b.branchType)?.label ?? b.branchType ?? '';
    return `${b.name}${type ? ` (${type})` : ''}`;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F6F2] px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  i <= step ? 'bg-[#1E2A44] text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-200" />}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
          )}

          {step === 0 && (
            <div>
              <h2 className="font-serif text-xl text-[#1E2A44] mb-1">Welcome{profile ? `, ${profile.name}` : ''}</h2>
              <p className="text-sm text-slate-500 mb-6">
                Let&rsquo;s get your workspace ready. Branding is already set — next we&rsquo;ll name the levels of
                your organization (province, diocese, parish, cell — whatever fits), then build your structure
                from the top down.
              </p>
              <Button onClick={() => setStep(1)} style={{ backgroundColor: '#1E2A44' }} className="w-full">
                Continue
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-serif text-xl text-[#1E2A44] mb-1">Your organizational levels</h2>
              <p className="text-sm text-slate-500">
                Every church is structured differently — name the levels yours actually has. A few common ones are
                already here; add, and keep, only what you need.
              </p>
              <div className="flex flex-wrap gap-2">
                {branchTypes.map((t) => (
                  <span key={t.key} className="text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600">
                    {t.label}
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddLevel} className="flex gap-2">
                <Input value={newLevelLabel} onChange={(e) => setNewLevelLabel(e.target.value)} placeholder="e.g. Diocese" />
                <Button type="submit" variant="outline">
                  Add level
                </Button>
              </form>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setStep(2)} style={{ backgroundColor: '#1E2A44' }} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-serif text-xl text-[#1E2A44] mb-1">Your top-level institution</h2>
              <p className="text-sm text-slate-500">
                Every church needs one top-level branch to start from — you&rsquo;ll add levels underneath it next.
              </p>
              <div>
                <Label htmlFor="hq-name" className="mb-1 text-slate-600">
                  Name
                </Label>
                <Input id="hq-name" value={headquartersName} onChange={(e) => setHeadquartersName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="hq-type" className="mb-1 text-slate-600">
                  Level
                </Label>
                <select
                  id="hq-type"
                  value={headquartersType}
                  onChange={(e) => setHeadquartersType(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                >
                  {branchTypes.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1" disabled={submitting}>
                  Back
                </Button>
                <Button
                  onClick={handleCreateHeadquarters}
                  style={{ backgroundColor: '#1E2A44' }}
                  className="flex-1"
                  disabled={submitting || !headquartersName.trim()}
                >
                  {submitting ? 'Creating…' : 'Create & continue'}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-serif text-xl text-[#1E2A44] mb-1">Build your structure</h2>
              <p className="text-sm text-slate-500">
                Add as many sub-levels as you need — a parish under your diocese, a cell under that parish, and so
                on. You can keep going here, or finish now and continue any time from the Branches page.
              </p>

              {branches.length > 0 && (
                <ul className="text-sm text-slate-600 space-y-1 max-h-32 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-2">
                  {branches.map((b) => (
                    <li key={b.id}>{branchLabel(b)}</li>
                  ))}
                </ul>
              )}

              <form onSubmit={handleAddChildBranch} className="space-y-2">
                <Input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Branch name" />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={childType}
                    onChange={(e) => setChildType(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                  >
                    {branchTypes.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={childParentId}
                    onChange={(e) => setChildParentId(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {branchLabel(b)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" variant="outline" className="w-full" disabled={!childName.trim()}>
                  Add branch
                </Button>
              </form>

              <Button onClick={() => setStep(4)} style={{ backgroundColor: '#1E2A44' }} className="w-full">
                Finish for now
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-4">
              <h2 className="font-serif text-xl text-[#1E2A44] mb-2">You&rsquo;re all set</h2>
              <p className="text-sm text-slate-500 mb-4">
                {hqBranch?.name ?? headquartersName} is ready, with {Math.max(branches.length - 1, 0)} branch
                {branches.length - 1 === 1 ? '' : 'es'} underneath it. Keep building your structure any time from
                the Branches page, or start inviting your team.
              </p>
              <a href="/admin/branches" className="text-sm font-medium text-[#1E2A44] underline underline-offset-2">
                Go to Organizational Structure →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
