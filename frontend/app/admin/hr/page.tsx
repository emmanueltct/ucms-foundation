'use client';

// app/admin/hr/page.tsx
// Lets a Church Administrator manage staff (HR) records and process payroll
// payments against them — pending, then marked paid or cancelled with a
// reason, never edited once paid.

import { useEffect, useState } from 'react';
import { staffApi, payrollApi, branchesApi, membersApi, configApi, isAccessDeniedResponse, Staff, PayrollPayment, Branch, Member } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { AccessDenied } from '../../../components/access-denied';

const TENANT_SLUG = 'demo-church';
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'volunteer_stipend'];

export default function HrAdminPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [positions, setPositions] = useState<{ key: string; label: string }[]>([]);
  const [departments, setDepartments] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState(EMPLOYMENT_TYPES[0]);
  const [baseSalary, setBaseSalary] = useState('');

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [deductions, setDeductions] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [staffRes, branchesRes, membersRes, posRes, deptRes] = await Promise.all([
        staffApi.list(TENANT_SLUG),
        branchesApi.list(TENANT_SLUG),
        membersApi.list(TENANT_SLUG, {}),
        configApi.listByNamespace(TENANT_SLUG, 'staff_position'),
        configApi.listByNamespace(TENANT_SLUG, 'department'),
      ]);
      if (isAccessDeniedResponse(staffRes)) {
        setAccessDenied(true);
        return;
      }
      if (staffRes.success && staffRes.data) setStaff(staffRes.data);
      else setError(staffRes.error?.message ?? 'Could not load staff.');
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
      if (membersRes.success && membersRes.data) setMembers(membersRes.data);
      if (posRes.success && posRes.data) setPositions(posRes.data as { key: string; label: string }[]);
      if (deptRes.success && deptRes.data) setDepartments(deptRes.data as { key: string; label: string }[]);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadPayments(staffId: string) {
    setPaymentsLoading(true);
    try {
      const res = await payrollApi.list(TENANT_SLUG, { staffId });
      if (res.success && res.data) setPayments(res.data);
      else setError(res.error?.message ?? 'Could not load payroll history.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setPaymentsLoading(false);
    }
  }

  function selectStaff(s: Staff) {
    setSelectedStaffId(s.id);
    loadPayments(s.id);
  }

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    try {
      const res = await staffApi.create(TENANT_SLUG, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        memberId: memberId || undefined,
        branchId: branchId || undefined,
        position: position || undefined,
        department: department || undefined,
        employmentType,
        baseSalary: baseSalary ? Number(baseSalary) : undefined,
      });
      if (res.success) {
        setFirstName('');
        setLastName('');
        setMemberId('');
        setBranchId('');
        setPosition('');
        setDepartment('');
        setBaseSalary('');
        load();
      } else {
        setError(res.error?.message ?? 'Could not create the staff record.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemoveStaff(id: string) {
    try {
      const res = await staffApi.remove(TENANT_SLUG, id);
      if (res.success) {
        if (selectedStaffId === id) setSelectedStaffId(null);
        load();
      } else {
        setError(res.error?.message ?? 'Could not remove the staff record.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleCreatePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStaffId || !periodStart || !periodEnd || !grossAmount) return;
    try {
      const res = await payrollApi.create(TENANT_SLUG, {
        staffId: selectedStaffId,
        periodStart,
        periodEnd,
        grossAmount: Number(grossAmount),
        deductions: deductions ? Number(deductions) : undefined,
      });
      if (res.success) {
        setPeriodStart('');
        setPeriodEnd('');
        setGrossAmount('');
        setDeductions('');
        loadPayments(selectedStaffId);
      } else {
        setError(res.error?.message ?? 'Could not create the payment.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleMarkPaid(id: string) {
    if (!selectedStaffId) return;
    try {
      const res = await payrollApi.markPaid(TENANT_SLUG, id);
      if (res.success) loadPayments(selectedStaffId);
      else setError(res.error?.message ?? 'Could not mark the payment paid.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleCancelPayment(id: string) {
    if (!selectedStaffId) return;
    const reason = window.prompt('Reason for cancelling this payment:');
    if (!reason || !reason.trim()) return;
    try {
      const res = await payrollApi.cancel(TENANT_SLUG, id, reason.trim());
      if (res.success) loadPayments(selectedStaffId);
      else setError(res.error?.message ?? 'Could not cancel the payment.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function statusBadge(status: PayrollPayment['status']) {
    const styles: Record<PayrollPayment['status'], string> = {
      pending: 'text-amber-700 bg-amber-50 border-amber-200',
      paid: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      cancelled: 'text-slate-400 bg-slate-50 border-slate-200 line-through',
    };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${styles[status]}`}>{status}</span>;
  }

  const selectedStaff = staff.find((s) => s.id === selectedStaffId) ?? null;

  if (accessDenied) return <AccessDenied />;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">HR &amp; Payroll</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Staff &amp; Payroll</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Manage staff records — optionally linked to an existing member — and process
            payroll: create a pending payment, then mark it paid or cancel it with a reason.
          </p>
        </header>

        <form onSubmit={handleCreateStaff} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="staff-first" className="mb-1 text-slate-600">First name</Label>
              <Input id="staff-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" />
            </div>
            <div>
              <Label htmlFor="staff-last" className="mb-1 text-slate-600">Last name</Label>
              <Input id="staff-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Uwimana" />
            </div>
            <div>
              <Label htmlFor="staff-member" className="mb-1 text-slate-600">Link to member (optional)</Label>
              <select
                id="staff-member"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— None —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="staff-branch" className="mb-1 text-slate-600">Branch (optional)</Label>
              <select
                id="staff-branch"
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
              <Label htmlFor="staff-position" className="mb-1 text-slate-600">Position (optional)</Label>
              <select
                id="staff-position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Unspecified —</option>
                {positions.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="staff-department" className="mb-1 text-slate-600">Department (optional)</Label>
              <select
                id="staff-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Unspecified —</option>
                {departments.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="staff-type" className="mb-1 text-slate-600">Employment type</Label>
              <select
                id="staff-type"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="staff-salary" className="mb-1 text-slate-600">Base salary (optional)</Label>
              <Input id="staff-salary" type="number" min="0" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} placeholder="500000" />
            </div>
          </div>
          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>Add staff</Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : staff.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No staff yet. Add your first one above.</div>
            ) : (
              staff.map((s) => (
                <div
                  key={s.id}
                  onClick={() => selectStaff(s)}
                  className={`flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer ${
                    selectedStaffId === s.id ? 'bg-[#1E2A44]/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.firstName} {s.lastName}</p>
                    <p className="text-xs text-slate-400">
                      {s.position ? s.position.replace(/_/g, ' ') : 'No position'} · {s.employmentStatus}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveStaff(s.id);
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
            {!selectedStaff ? (
              <div className="py-8 text-center text-sm text-slate-400">Select a staff member to manage payroll.</div>
            ) : (
              <>
                <h2 className="font-serif text-lg text-[#1E2A44] mb-3">
                  {selectedStaff.firstName} {selectedStaff.lastName} — payroll
                </h2>
                <form onSubmit={handleCreatePayment} className="space-y-2 mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} placeholder="Period start" />
                    <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} placeholder="Period end" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" min="0" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} placeholder="Gross amount" />
                    <Input type="number" min="0" value={deductions} onChange={(e) => setDeductions(e.target.value)} placeholder="Deductions (optional)" />
                  </div>
                  <Button type="submit" size="sm" style={{ backgroundColor: '#1E2A44' }}>Create payment</Button>
                </form>

                {paymentsLoading ? (
                  <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
                ) : payments.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">No payroll payments yet.</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {payments.map((p) => (
                      <div key={p.id} className="py-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {p.netAmount} {p.currency}
                            </p>
                            <p className="text-xs text-slate-400">
                              {p.periodStart.slice(0, 10)} – {p.periodEnd.slice(0, 10)}
                            </p>
                          </div>
                          {statusBadge(p.status)}
                        </div>
                        {p.status === 'pending' && (
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => handleMarkPaid(p.id)}
                              className="text-xs font-medium px-3 py-1 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                              Mark paid
                            </button>
                            <button
                              onClick={() => handleCancelPayment(p.id)}
                              className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
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
