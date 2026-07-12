'use client';

// app/admin/finance/page.tsx
// Lets a Finance Officer / Church Administrator record contributions against
// a Branch and (optionally) a Member, and review totals by fund, through the
// Finance module. Contributions are never edited/deleted here beyond
// notes/receipt number — mistakes are corrected by voiding with a reason.

import { useEffect, useState } from 'react';
import {
  contributionsApi,
  branchesApi,
  membersApi,
  configApi,
  isAccessDeniedResponse,
  Contribution,
  ContributionSummary,
  Branch,
  Member,
} from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { AccessDenied } from '../../../components/access-denied';

const TENANT_SLUG = 'demo-church'; // in production this comes from the resolved workspace/domain

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'mobile_money', 'cheque', 'other'];

export default function FinanceAdminPage() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [summary, setSummary] = useState<ContributionSummary[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [contributionTypes, setContributionTypes] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [branchId, setBranchId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [contributionType, setContributionType] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [contributedAt, setContributedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptNumber, setReceiptNumber] = useState('');

  const [voidTargetId, setVoidTargetId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [contribRes, summaryRes, branchesRes, membersRes, typesRes] = await Promise.all([
        contributionsApi.list(TENANT_SLUG),
        contributionsApi.summary(TENANT_SLUG),
        branchesApi.list(TENANT_SLUG),
        membersApi.list(TENANT_SLUG, {}),
        configApi.listByNamespace(TENANT_SLUG, 'contribution_type'),
      ]);
      if (isAccessDeniedResponse(contribRes)) {
        setAccessDenied(true);
        return;
      }
      if (contribRes.success && contribRes.data) setContributions(contribRes.data);
      else setError(contribRes.error?.message ?? 'Could not load contributions.');
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
      if (membersRes.success && membersRes.data) setMembers(membersRes.data);
      if (typesRes.success && typesRes.data) setContributionTypes(typesRes.data as { key: string; label: string }[]);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!branchId || !contributionType || !parsedAmount || parsedAmount <= 0) {
      setError('Branch, contribution type, and a positive amount are required.');
      return;
    }
    try {
      const res = await contributionsApi.create(TENANT_SLUG, {
        branchId,
        memberId: memberId || undefined,
        contributionType,
        amount: parsedAmount,
        paymentMethod,
        contributedAt,
        receiptNumber: receiptNumber.trim() || undefined,
      });
      if (res.success) {
        setMemberId('');
        setAmount('');
        setReceiptNumber('');
        load();
      } else {
        setError(res.error?.message ?? 'Could not record the contribution.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleVoid(id: string) {
    if (!voidReason.trim()) {
      setError('A reason is required to void a contribution.');
      return;
    }
    try {
      const res = await contributionsApi.void(TENANT_SLUG, id, voidReason.trim());
      if (res.success) {
        setVoidTargetId(null);
        setVoidReason('');
        load();
      } else {
        setError(res.error?.message ?? 'Could not void the contribution.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function branchName(id: string) {
    return branches.find((b) => b.id === id)?.name ?? '—';
  }

  function memberName(id: string | null) {
    if (!id) return '—';
    const m = members.find((mm) => mm.id === id);
    return m ? `${m.firstName} ${m.lastName}` : '—';
  }

  if (accessDenied) return <AccessDenied />;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Finance</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Contributions</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Record tithes, offerings, and other gifts against a branch and, where known, a
            member. Mistakes are corrected by voiding with a reason — financial records are
            never edited or deleted.
          </p>
        </header>

        {summary.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {summary.map((s) => (
              <div key={s.contributionType} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">{s.contributionType.replace(/_/g, ' ')}</p>
                <p className="font-serif text-xl text-[#1E2A44] mt-1">{s.total}</p>
                <p className="text-xs text-slate-400">{s.count} contribution{s.count === 1 ? '' : 's'}</p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="contrib-branch" className="mb-1 text-slate-600">
                Branch
              </Label>
              <select
                id="contrib-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Select a branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contrib-member" className="mb-1 text-slate-600">
                Member (optional)
              </Label>
              <select
                id="contrib-member"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Anonymous —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contrib-type" className="mb-1 text-slate-600">
                Type
              </Label>
              <select
                id="contrib-type"
                value={contributionType}
                onChange={(e) => setContributionType(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Select a type —</option>
                {contributionTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contrib-amount" className="mb-1 text-slate-600">
                Amount
              </Label>
              <Input id="contrib-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25000" />
            </div>
            <div>
              <Label htmlFor="contrib-method" className="mb-1 text-slate-600">
                Payment method
              </Label>
              <select
                id="contrib-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contrib-date" className="mb-1 text-slate-600">
                Date
              </Label>
              <Input id="contrib-date" type="date" value={contributedAt} onChange={(e) => setContributedAt(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="contrib-receipt" className="mb-1 text-slate-600">
                Receipt number (optional)
              </Label>
              <Input id="contrib-receipt" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="RCT-0001" />
            </div>
          </div>
          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>
            Record contribution
          </Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : contributions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No contributions yet. Record your first one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Branch</th>
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3 text-slate-600">{c.contributedAt.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-slate-600">{c.contributionType.replace(/_/g, ' ')}</td>
                      <td className={`px-4 py-3 font-medium ${c.isVoided ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {c.amount} {c.currency}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{branchName(c.branchId)}</td>
                      <td className="px-4 py-3 text-slate-600">{memberName(c.memberId)}</td>
                      <td className="px-4 py-3">
                        {c.isVoided ? (
                          <span
                            title={c.voidReason ?? undefined}
                            className="text-xs font-medium px-2 py-0.5 rounded-full border text-slate-500 bg-slate-100 border-slate-200"
                          >
                            voided
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full border text-emerald-700 bg-emerald-50 border-emerald-200">
                            recorded
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!c.isVoided &&
                          (voidTargetId === c.id ? (
                            <div className="flex items-center gap-2 justify-end">
                              <input
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                placeholder="Reason…"
                                className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                              />
                              <button
                                onClick={() => handleVoid(c.id)}
                                className="text-xs font-medium px-2 py-1 rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => {
                                  setVoidTargetId(null);
                                  setVoidReason('');
                                }}
                                className="text-xs font-medium px-2 py-1 rounded-full border border-slate-200 text-slate-500"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setVoidTargetId(c.id)}
                              className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                            >
                              Void
                            </button>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
