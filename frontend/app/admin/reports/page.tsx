'use client';

// app/admin/reports/page.tsx
// Read-only dashboard over data that already lives in Finance, Attendance,
// Member & Family, and HR & Payroll — this page stores nothing of its own,
// it just visualizes what the Reports & Analytics backend module computes
// live on each request.

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Users, Briefcase, Building2, CalendarDays, Wallet, TrendingUp, Download } from 'lucide-react';
import {
  reportsApi,
  ReportOverview,
  MonthBucket,
  KeyBucket,
  MembershipGrowthBucket,
  ExportFormat,
} from '../../../lib/api';

const TENANT_SLUG = 'demo-church';
const NAVY = '#1E2A44';
const GOLD = '#C9A24B';

const EXPORT_FORMATS: ExportFormat[] = ['csv', 'xlsx', 'pdf'];

/** One row of "Download as CSV / XLSX / PDF" buttons for a report section — shared by Finance/Attendance/Membership/Payroll. */
function ExportRow({ label, onExport }: { label: string; onExport: (format: ExportFormat) => Promise<{ success: boolean; error?: string }> }) {
  const [pending, setPending] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(format: ExportFormat) {
    setPending(format);
    setError(null);
    try {
      const result = await onExport(format);
      if (!result.success) setError(result.error ?? 'Export failed.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs font-medium text-slate-500 w-28">{label}</span>
      {EXPORT_FORMATS.map((format) => (
        <button
          key={format}
          onClick={() => handleClick(format)}
          disabled={pending !== null}
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-[#1E2A44]/40 disabled:opacity-50"
        >
          <Download className="h-3 w-3" strokeWidth={2} />
          {pending === format ? '…' : format.toUpperCase()}
        </button>
      ))}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export default function ReportsAdminPage() {
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [finance, setFinance] = useState<{ byMonth: MonthBucket[]; byType: KeyBucket[] }>({ byMonth: [], byType: [] });
  const [attendance, setAttendance] = useState<{ byMonth: MonthBucket[]; byServiceType: KeyBucket[] }>({
    byMonth: [],
    byServiceType: [],
  });
  const [membership, setMembership] = useState<{ newMembersByMonth: MembershipGrowthBucket[] }>({
    newMembersByMonth: [],
  });
  const [payroll, setPayroll] = useState<{ byMonth: MonthBucket[]; byDepartment: KeyBucket[] }>({
    byMonth: [],
    byDepartment: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, financeRes, attendanceRes, membershipRes, payrollRes] = await Promise.all([
        reportsApi.overview(TENANT_SLUG),
        reportsApi.financeSummary(TENANT_SLUG),
        reportsApi.attendanceTrends(TENANT_SLUG),
        reportsApi.membershipGrowth(TENANT_SLUG),
        reportsApi.payrollSummary(TENANT_SLUG),
      ]);
      if (overviewRes.success && overviewRes.data) setOverview(overviewRes.data);
      else setError(overviewRes.error?.message ?? 'Could not load the dashboard.');
      if (financeRes.success && financeRes.data) setFinance(financeRes.data);
      if (attendanceRes.success && attendanceRes.data) setAttendance(attendanceRes.data);
      if (membershipRes.success && membershipRes.data) setMembership(membershipRes.data);
      if (payrollRes.success && payrollRes.data) setPayroll(payrollRes.data);
    } catch {
      setError('Could not reach the server. Check the API is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const kpis = overview
    ? [
        { label: 'Active members', value: overview.members, icon: Users },
        { label: 'Active staff', value: overview.activeStaff, icon: Briefcase },
        { label: 'Branches', value: overview.branches, icon: Building2 },
        { label: 'Upcoming events', value: overview.upcomingEvents, icon: CalendarDays },
        { label: 'Giving this month', value: overview.contributionsThisMonth.toLocaleString(), icon: Wallet },
        { label: 'Attendance (30d)', value: overview.attendanceLast30Days, icon: TrendingUp },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-[#C9A24B] font-medium mb-1">Reports &amp; Analytics</p>
          <h1 className="font-serif text-3xl text-[#1E2A44]">Church at a glance</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            Trailing 12-month trends computed live from Finance, Attendance, Membership, and HR
            &amp; Payroll — nothing on this page is stored separately.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-6">{error}</div>
        )}

        {loading && !overview ? (
          <div className="text-center text-sm text-slate-400 py-12">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
              {kpis.map((k) => (
                <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <k.icon className="h-4 w-4 text-[#C9A24B] mb-2" strokeWidth={2} />
                  <p className="font-serif text-2xl text-[#1E2A44]">{k.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
              <h3 className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-3">
                Export trailing 12-month data
              </h3>
              <ExportRow label="Finance" onExport={(format) => reportsApi.exportFinanceSummary(TENANT_SLUG, format)} />
              <ExportRow label="Attendance" onExport={(format) => reportsApi.exportAttendanceTrends(TENANT_SLUG, format)} />
              <ExportRow label="Membership" onExport={(format) => reportsApi.exportMembershipGrowth(TENANT_SLUG, format)} />
              <ExportRow label="Payroll" onExport={(format) => reportsApi.exportPayrollSummary(TENANT_SLUG, format)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Giving by month">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={finance.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke={NAVY} strokeWidth={2} dot={false} name="Total given" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Giving by type">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={finance.byType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={GOLD} radius={[4, 4, 0, 0]} name="Total" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Attendance by month">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={attendance.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke={NAVY} strokeWidth={2} dot={false} name="Headcount" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Attendance by service type">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={attendance.byServiceType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={GOLD} radius={[4, 4, 0, 0]} name="Headcount" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Membership growth">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={membership.newMembersByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="cumulativeActive" stroke={NAVY} strokeWidth={2} dot={false} name="Cumulative active" />
                    <Line type="monotone" dataKey="total" stroke={GOLD} strokeWidth={2} dot={false} name="New members" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Payroll cost by month">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={payroll.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={NAVY} radius={[4, 4, 0, 0]} name="Net paid" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {payroll.byDepartment.length > 0 && (
              <ChartCard title="Payroll by department" className="mt-6">
                <ResponsiveContainer width="100%" height={Math.max(160, payroll.byDepartment.length * 40)}>
                  <BarChart data={payroll.byDepartment} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="key" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="total" fill={GOLD} radius={[0, 4, 4, 0]} name="Net paid" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <h3 className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-3">{title}</h3>
      {children}
    </div>
  );
}
