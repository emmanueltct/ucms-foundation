'use client';

// app/admin/attendance/page.tsx
// Lets a Ministry Leader / Church Administrator record attendance for a
// service — either checking in a named member or logging an anonymous
// head-count — against a Branch, and review totals by service type.

import { useEffect, useState } from 'react';
import { attendanceApi, branchesApi, membersApi, configApi, isAccessDeniedResponse, AttendanceRecord, AttendanceSummary, Branch, Member } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { AccessDenied } from '../../../components/access-denied';

const TENANT_SLUG = 'demo-church'; // in production this comes from the resolved workspace/domain

export default function AttendanceAdminPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [serviceTypes, setServiceTypes] = useState<{ key: string; label: string }[]>([]);
  const [attendanceMethods, setAttendanceMethods] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [mode, setMode] = useState<'individual' | 'headcount'>('individual');
  const [branchId, setBranchId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [attendanceMethod, setAttendanceMethod] = useState('');
  const [headcount, setHeadcount] = useState('');
  const [attendedAt, setAttendedAt] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [recordsRes, summaryRes, branchesRes, membersRes, serviceTypesRes, methodsRes] = await Promise.all([
        attendanceApi.list(TENANT_SLUG),
        attendanceApi.summary(TENANT_SLUG),
        branchesApi.list(TENANT_SLUG),
        membersApi.list(TENANT_SLUG, {}),
        configApi.listByNamespace(TENANT_SLUG, 'service_type'),
        configApi.listByNamespace(TENANT_SLUG, 'attendance_method'),
      ]);
      if (isAccessDeniedResponse(recordsRes)) {
        setAccessDenied(true);
        return;
      }
      if (recordsRes.success && recordsRes.data) setRecords(recordsRes.data);
      else setError(recordsRes.error?.message ?? 'Could not load attendance records.');
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data);
      if (membersRes.success && membersRes.data) setMembers(membersRes.data);
      if (serviceTypesRes.success && serviceTypesRes.data) setServiceTypes(serviceTypesRes.data as { key: string; label: string }[]);
      if (methodsRes.success && methodsRes.data) setAttendanceMethods(methodsRes.data as { key: string; label: string }[]);
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
    if (!branchId || !serviceType) {
      setError('Branch and service type are required.');
      return;
    }
    if (mode === 'headcount' && (!headcount || Number(headcount) <= 0)) {
      setError('A positive headcount is required for an anonymous entry.');
      return;
    }
    try {
      const res = await attendanceApi.create(TENANT_SLUG, {
        branchId,
        memberId: mode === 'individual' ? memberId || undefined : undefined,
        serviceType,
        attendanceMethod: attendanceMethod || undefined,
        headcount: mode === 'headcount' ? Number(headcount) : undefined,
        attendedAt,
      });
      if (res.success) {
        setMemberId('');
        setHeadcount('');
        load();
      } else {
        setError(res.error?.message ?? 'Could not record attendance.');
      }
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  async function handleRemove(id: string) {
    try {
      const res = await attendanceApi.remove(TENANT_SLUG, id);
      if (res.success) load();
      else setError(res.error?.message ?? 'Could not remove the record.');
    } catch {
      setError('Could not reach the server. Check the API is running.');
    }
  }

  function branchName(id: string) {
    return branches.find((b) => b.id === id)?.name ?? '—';
  }

  function memberName(id: string | null) {
    if (!id) return 'Head-count only';
    const m = members.find((mm) => mm.id === id);
    return m ? `${m.firstName} ${m.lastName}` : '—';
  }

  if (accessDenied) return <AccessDenied />;

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Attendance</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Who was here</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Check in a named member, or log a head-count when a full roll call isn&rsquo;t practical
            — both count toward the same service totals below.
          </p>
        </header>

        {summary.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {summary.map((s) => (
              <div key={s.serviceType} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">{s.serviceType.replace(/_/g, ' ')}</p>
                <p className="font-serif text-xl text-[#1E2A44] mt-1">{s.totalAttendance}</p>
                <p className="text-xs text-slate-400">{s.recordCount} record{s.recordCount === 1 ? '' : 's'}</p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4 mb-6 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('individual')}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                mode === 'individual' ? 'bg-[#1E2A44] text-white border-[#1E2A44]' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              Check in a member
            </button>
            <button
              type="button"
              onClick={() => setMode('headcount')}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                mode === 'headcount' ? 'bg-[#1E2A44] text-white border-[#1E2A44]' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              Log a head-count
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="att-branch" className="mb-1 text-slate-600">
                Branch
              </Label>
              <select
                id="att-branch"
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

            {mode === 'individual' ? (
              <div>
                <Label htmlFor="att-member" className="mb-1 text-slate-600">
                  Member
                </Label>
                <select
                  id="att-member"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
                >
                  <option value="">— Select a member —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <Label htmlFor="att-headcount" className="mb-1 text-slate-600">
                  Head-count
                </Label>
                <Input
                  id="att-headcount"
                  type="number"
                  min="1"
                  step="1"
                  value={headcount}
                  onChange={(e) => setHeadcount(e.target.value)}
                  placeholder="214"
                />
              </div>
            )}

            <div>
              <Label htmlFor="att-service" className="mb-1 text-slate-600">
                Service type
              </Label>
              <select
                id="att-service"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Select a type —</option>
                {serviceTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="att-method" className="mb-1 text-slate-600">
                Method (optional)
              </Label>
              <select
                id="att-method"
                value={attendanceMethod}
                onChange={(e) => setAttendanceMethod(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1E2A44]/20"
              >
                <option value="">— Unspecified —</option>
                {attendanceMethods.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="att-date" className="mb-1 text-slate-600">
                Date
              </Label>
              <Input id="att-date" type="date" value={attendedAt} onChange={(e) => setAttendedAt(e.target.value)} />
            </div>
          </div>
          <Button type="submit" style={{ backgroundColor: '#1E2A44' }}>
            Record attendance
          </Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : records.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No attendance recorded yet. Log your first one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Service</th>
                    <th className="px-4 py-3 font-medium">Who</th>
                    <th className="px-4 py-3 font-medium">Branch</th>
                    <th className="px-4 py-3 font-medium">Count</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3 text-slate-600">{r.attendedAt.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-slate-600">{r.serviceType.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-slate-600">{memberName(r.memberId)}</td>
                      <td className="px-4 py-3 text-slate-600">{branchName(r.branchId)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.headcount}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemove(r.id)}
                          className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                        >
                          Remove
                        </button>
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
