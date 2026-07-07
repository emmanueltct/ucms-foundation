'use client';

// app/onboarding/page.tsx
// First-run wizard for a newly provisioned church: confirm branding, name
// the headquarters branch, then finish — which idempotently ensures a
// headquarters branch exists and marks the tenant onboarded (see
// docs/church-hierarchy/functional-requirements.md, FR-CH-5).

import { useEffect, useState } from 'react';
import { tenantApi, TenantProfile } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

const TENANT_SLUG = 'demo-church'; // in production this comes from the resolved workspace/domain

const STEPS = ['Welcome', 'Headquarters', 'Finish'] as const;

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [headquartersName, setHeadquartersName] = useState('');
  const [headquartersType, setHeadquartersType] = useState('headquarters');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
  }, []);

  async function handleFinish() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await tenantApi.completeOnboarding(TENANT_SLUG, {
        headquartersName: headquartersName.trim() || undefined,
        headquartersType: headquartersType.trim() || undefined,
      });
      if (res.success) {
        setDone(true);
      } else {
        setError(res.error?.message ?? 'Could not complete onboarding.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F6F2] px-4">
      <div className="w-full max-w-md">
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

          {done ? (
            <div className="text-center py-4">
              <h2 className="font-serif text-xl text-[#1E2A44] mb-2">You&rsquo;re all set</h2>
              <p className="text-sm text-slate-500 mb-4">
                {headquartersName || profile?.name} is ready. Head to the hierarchy page to add branches, or start
                inviting your team.
              </p>
              <a href="/admin/branches" className="text-sm font-medium text-[#1E2A44] underline underline-offset-2">
                Go to Organizational Structure →
              </a>
            </div>
          ) : step === 0 ? (
            <div>
              <h2 className="font-serif text-xl text-[#1E2A44] mb-1">Welcome{profile ? `, ${profile.name}` : ''}</h2>
              <p className="text-sm text-slate-500 mb-6">
                Let&rsquo;s get your workspace ready. This takes about a minute — branding is already set, so next
                we&rsquo;ll name your headquarters.
              </p>
              <Button onClick={() => setStep(1)} style={{ backgroundColor: '#1E2A44' }} className="w-full">
                Continue
              </Button>
            </div>
          ) : step === 1 ? (
            <div className="space-y-4">
              <h2 className="font-serif text-xl text-[#1E2A44] mb-1">Your headquarters</h2>
              <p className="text-sm text-slate-500">
                Every church needs one top-level branch to start from — you can add parishes, districts, or cells
                underneath it any time afterward.
              </p>
              <div>
                <Label htmlFor="hq-name" className="mb-1 text-slate-600">
                  Headquarters name
                </Label>
                <Input id="hq-name" value={headquartersName} onChange={(e) => setHeadquartersName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="hq-type" className="mb-1 text-slate-600">
                  Type
                </Label>
                <Input id="hq-type" value={headquartersType} onChange={(e) => setHeadquartersType(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  style={{ backgroundColor: '#1E2A44' }}
                  className="flex-1"
                  disabled={!headquartersName.trim()}
                >
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="font-serif text-xl text-[#1E2A44] mb-1">Review &amp; finish</h2>
              <dl className="text-sm text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Church</dt>
                  <dd>{profile?.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Headquarters</dt>
                  <dd>{headquartersName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Type</dt>
                  <dd>{headquartersType}</dd>
                </div>
              </dl>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1" disabled={submitting}>
                  Back
                </Button>
                <Button
                  onClick={handleFinish}
                  style={{ backgroundColor: '#1E2A44' }}
                  className="flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'Finishing…' : 'Complete setup'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
