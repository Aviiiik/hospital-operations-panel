import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, TrendingUp, TrendingDown, Minus, BedDouble, LogIn, LogOut, BedSingle, IndianRupee, Receipt, BadgePercent, Microscope } from "lucide-react";
import opdService from "@/services/opdService";
import ipdService from "@/services/ipdService";
import diagnosticsService, { type DiagnosticsDashboardStats } from "@/services/diagnosticsService";
import { useAuth } from "@/contexts/AuthContext";
import DatePresetFilter, { type DatePreset, getDateRange } from "@/components/DatePresetFilter";

interface OpdStats {
  admissions: { current: number; previous: number };
  revenue:    { current: number; previous: number };
}

interface IpdStats {
  currentlyAdmitted:  number;
  admittedInRange:    number;
  dischargedInRange:  number;
  bedsOccupied:       number;
  revenueInRange:     number;
  recentAdmissions:   RecentAdmission[];
}

interface RecentAdmission {
  _id:          string;
  admissionId:  string;
  name:         string;
  bedNo:        string;
  bedCategory:  string;
  department:   string;
  admissionDate: string;
  status:       string;
}

interface ActivityRow {
  _id: string;
  bookingId: string;
  patient: { name: string; patientId: string; phone: string } | null;
  doctorName: string;
  department: string;
  visitTime: string;
  billAmount: number;
  status: "Paid" | "Pending" | "Cancelled";
  createdAt: string;
}

function pctChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0
      ? { text: "No data for previous period", icon: null, color: "text-gray-500" }
      : { text: "No activity yet",             icon: null, color: "text-gray-400" };
  }
  const p = Math.round(((current - previous) / previous) * 100);
  if (p > 0)  return { text: `${p}% vs previous period`,         icon: "up",   color: "text-green-600" };
  if (p < 0)  return { text: `${Math.abs(p)}% vs previous period`, icon: "down", color: "text-red-500" };
  return       { text: "Same as previous period",                    icon: "flat", color: "text-gray-500" };
}

function formatRevenue(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

const OPD_STATUS_STYLE: Record<string, string> = {
  Paid:      "bg-green-100 text-green-700",
  Pending:   "bg-yellow-100 text-yellow-700",
  Cancelled: "bg-red-100 text-red-600",
};

const IPD_STATUS_STYLE: Record<string, string> = {
  Admitted:   "bg-green-100 text-green-700",
  Discharged: "bg-gray-100 text-gray-600",
};

const PRESET_LABELS: Record<DatePreset, string> = {
  today: "Today", yesterday: "Yesterday", this_week: "This Week", this_month: "This Month",
  last_month: "Last Month", last_3_months: "Last 3 Months", last_6_months: "Last 6 Months",
  custom: "Selected Range",
};

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const c = pctChange(current, previous);
  return (
    <p className={`text-xs mt-1 flex items-center gap-1 ${c.color}`}>
      {c.icon === "up"   && <TrendingUp   className="h-3 w-3" />}
      {c.icon === "down" && <TrendingDown className="h-3 w-3" />}
      {c.icon === "flat" && <Minus        className="h-3 w-3" />}
      {c.icon === "up" ? "↑ " : c.icon === "down" ? "↓ " : ""}
      {c.text}
    </p>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "";
  // Diagnostics users see only Diagnostics stats — never OPD/IPD (the OPD stats
  // API also refuses them). Admin sees everything; other roles are unchanged.
  const showOpdIpd       = role !== "diagnostics";
  const showDiagnostics  = role === "admin" || role === "diagnostics";

  const [preset, setPreset] = useState<DatePreset>("today");
  const initialRange = getDateRange("today");
  const [range, setRange] = useState<{ from: string; to: string }>({
    from: initialRange.from.toISOString(),
    to:   initialRange.to.toISOString(),
  });

  const [opdStats,   setOpdStats]   = useState<OpdStats | null>(null);
  const [ipdStats,   setIpdStats]   = useState<IpdStats | null>(null);
  const [activity,   setActivity]   = useState<ActivityRow[]>([]);
  const [opdLoading, setOpdLoading] = useState(true);
  const [ipdLoading, setIpdLoading] = useState(true);
  const [actLoading, setActLoading] = useState(true);
  const [diagStats,   setDiagStats]   = useState<DiagnosticsDashboardStats | null>(null);
  const [diagLoading, setDiagLoading] = useState(true);

  const handleRangeChange = (p: DatePreset, r: { from: Date; to: Date }) => {
    setPreset(p);
    setRange({ from: r.from.toISOString(), to: r.to.toISOString() });
  };

  const loadAll = (from: string, to: string) => {
    if (showDiagnostics) {
      diagnosticsService.getDashboardStats(from, to)
        .then(r => setDiagStats(r.data.data))
        .catch(() => {})
        .finally(() => setDiagLoading(false));
    }
    if (!showOpdIpd) return;

    opdService.getDashboardStats(from, to)
      .then(r => setOpdStats(r.data.data))
      .catch(() => {})
      .finally(() => setOpdLoading(false));

    ipdService.getDashboardStats(from, to)
      .then(r => setIpdStats(r.data.data))
      .catch(() => {})
      .finally(() => setIpdLoading(false));

    opdService.getTodayActivity(from, to)
      .then(r => setActivity(r.data.data.activity))
      .catch(() => {})
      .finally(() => setActLoading(false));
  };

  useEffect(() => {
    loadAll(range.from, range.to);

    const interval = setInterval(() => loadAll(range.from, range.to), 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{showOpdIpd ? "Hospital Dashboard" : "Diagnostics Dashboard"}</h1>
          <p className="text-gray-500 mt-1">Overview for the selected period</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Period</p>
          <DatePresetFilter value={preset} onChange={handleRangeChange} />
        </div>
      </div>

      {showDiagnostics && !showOpdIpd && (
        <DiagnosticsSection stats={diagStats} loading={diagLoading} periodLabel={PRESET_LABELS[preset]} />
      )}

      {showOpdIpd && (<>
      {/* ── OPD Stats ───────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">OPD</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Admissions ({PRESET_LABELS[preset]})</CardTitle>
              <Users className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{opdLoading ? "—" : opdStats?.admissions.current ?? 0}</div>
              {opdStats && <TrendBadge current={opdStats.admissions.current} previous={opdStats.admissions.previous} />}
              {!opdStats && !opdLoading && <p className="text-xs mt-1 text-gray-400">Could not load</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Previous Period</CardTitle>
              <Calendar className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{opdLoading ? "—" : opdStats?.admissions.previous ?? 0}</div>
              <p className="text-xs text-gray-500 mt-1">Admissions in the preceding equal-length period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue ({PRESET_LABELS[preset]})</CardTitle>
              <span className="text-emerald-600 font-bold text-lg">₹</span>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{opdLoading ? "—" : formatRevenue(opdStats?.revenue.current ?? 0)}</div>
              {opdStats && <TrendBadge current={opdStats.revenue.current} previous={opdStats.revenue.previous} />}
              {!opdLoading && opdStats && (
                <p className="text-xs text-gray-400 mt-0.5">Previous period: {formatRevenue(opdStats.revenue.previous)}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── IPD Stats ───────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">IPD</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
          <Card className="border-green-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Currently Admitted</CardTitle>
              <BedDouble className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700">
                {ipdLoading ? "—" : ipdStats?.currentlyAdmitted ?? 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Active patients (live, not period-filtered)</p>
            </CardContent>
          </Card>

          <Card className="border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Admitted ({PRESET_LABELS[preset]})</CardTitle>
              <LogIn className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700">
                {ipdLoading ? "—" : ipdStats?.admittedInRange ?? 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">New admissions</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Discharged ({PRESET_LABELS[preset]})</CardTitle>
              <LogOut className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {ipdLoading ? "—" : ipdStats?.dischargedInRange ?? 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Discharges in period</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Beds Occupied</CardTitle>
              <BedSingle className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-700">
                {ipdLoading ? "—" : ipdStats?.bedsOccupied ?? 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Assigned beds (live, not period-filtered)</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue ({PRESET_LABELS[preset]})</CardTitle>
              <IndianRupee className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-700">
                {ipdLoading ? "—" : formatRevenue(ipdStats?.revenueInRange ?? 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Receipts collected + due at discharge</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent IPD admissions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>IPD Patients Admitted ({PRESET_LABELS[preset]})</CardTitle>
            <button
              onClick={() => navigate("/ipd/search")}
              className="text-xs text-blue-600 hover:underline"
            >
              View all →
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {ipdLoading ? (
              <p className="text-gray-400 text-center py-8 text-sm">Loading…</p>
            ) : !ipdStats?.recentAdmissions.length ? (
              <p className="text-gray-500 text-center py-8 text-sm">No IPD patients admitted in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-medium">Admission ID</th>
                      <th className="text-left px-4 py-3 font-medium">Patient</th>
                      <th className="text-left px-4 py-3 font-medium">Department</th>
                      <th className="text-left px-4 py-3 font-medium">Bed</th>
                      <th className="text-left px-4 py-3 font-medium">Admitted</th>
                      <th className="text-center px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ipdStats.recentAdmissions.map(p => (
                      <tr
                        key={p._id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/ipd/edit/${p._id}`)}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.admissionId}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-3 text-gray-500">{p.department || "—"}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {p.bedNo ? `${p.bedNo}` : "—"}
                          {p.bedCategory ? <span className="text-xs text-gray-400 ml-1">({p.bedCategory.split(" ")[0]})</span> : null}
                        </td>
                        <td className="px-4 py-3 text-gray-500 tabular-nums">{formatDate(p.admissionDate)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${IPD_STATUS_STYLE[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── OPD Activity ────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">OPD — Activity ({PRESET_LABELS[preset]})</h2>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Patient Activity</CardTitle>
            {!actLoading && (
              <span className="text-sm text-gray-500">{activity.length} booking{activity.length !== 1 ? "s" : ""}</span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {actLoading ? (
              <p className="text-gray-400 text-center py-12 text-sm">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="text-gray-500 text-center py-12 text-sm">No bookings recorded in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-medium">#</th>
                      <th className="text-left px-4 py-3 font-medium">Patient</th>
                      <th className="text-left px-4 py-3 font-medium">Doctor</th>
                      <th className="text-left px-4 py-3 font-medium">Department</th>
                      <th className="text-left px-4 py-3 font-medium">Time</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                      <th className="text-center px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activity.map((row, i) => (
                      <tr key={row._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{row.patient?.name ?? "—"}</div>
                          <div className="text-xs text-gray-400">{row.patient?.patientId ?? row.bookingId}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.doctorName}</td>
                        <td className="px-4 py-3 text-gray-500">{row.department}</td>
                        <td className="px-4 py-3 text-gray-500 tabular-nums">
                          {row.visitTime || formatTime(row.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                          ₹{row.billAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${OPD_STATUS_STYLE[row.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      </>)}

      {showDiagnostics && showOpdIpd && (
        <DiagnosticsSection stats={diagStats} loading={diagLoading} periodLabel={PRESET_LABELS[preset]} />
      )}
    </div>
  );
}

// ── Diagnostics ──────────────────────────────────────────────────────────────
// Bills are counted by bill date. Department / top-test amounts are gross test
// rates (before the bill discount); Revenue is the net billed amount.
function DiagnosticsSection({ stats, loading, periodLabel }: {
  stats: DiagnosticsDashboardStats | null;
  loading: boolean;
  periodLabel: string;
}) {
  const navigate = useNavigate();
  const bills   = stats?.patients.current ?? 0;
  const revenue = stats?.revenue.current ?? 0;
  const avgBill = bills ? Math.round(revenue / bills) : 0;
  const maxDept = Math.max(1, ...(stats?.byDepartment ?? []).map(d => d.amount));

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Diagnostics</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Patients / Bills ({periodLabel})</CardTitle>
            <Receipt className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{loading ? "—" : bills}</div>
            {stats && <TrendBadge current={stats.patients.current} previous={stats.patients.previous} />}
            {!stats && !loading && <p className="text-xs mt-1 text-gray-400">Could not load</p>}
          </CardContent>
        </Card>

        <Card className="border-emerald-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue ({periodLabel})</CardTitle>
            <IndianRupee className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700">{loading ? "—" : formatRevenue(revenue)}</div>
            {stats && <TrendBadge current={stats.revenue.current} previous={stats.revenue.previous} />}
            {stats && <p className="text-xs text-gray-400 mt-0.5">Previous period: {formatRevenue(stats.revenue.previous)}</p>}
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Bill</CardTitle>
            <Microscope className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">{loading ? "—" : formatRevenue(avgBill)}</div>
            <p className="text-xs text-gray-500 mt-1">Net amount per bill</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Discount Given</CardTitle>
            <BadgePercent className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{loading ? "—" : formatRevenue(stats?.discount ?? 0)}</div>
            <p className="text-xs text-gray-500 mt-1">Total bill discounts</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* By department + payment mode */}
        <Card>
          <CardHeader><CardTitle className="text-base">By Department</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-gray-400 text-sm text-center py-4">Loading…</p>
            ) : !stats?.byDepartment.length ? (
              <p className="text-gray-500 text-sm text-center py-4">No tests billed in this period</p>
            ) : (
              stats.byDepartment.map(d => (
                <div key={d.department}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-800">{d.department}</span>
                    <span className="tabular-nums text-gray-900">{formatRevenue(d.amount)}</span>
                  </div>
                  <div className="h-2 rounded bg-gray-100 mt-1 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded" style={{ width: `${(d.amount / maxDept) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{d.tests} test{d.tests !== 1 ? "s" : ""}</p>
                </div>
              ))
            )}
            {!!stats?.byPaymentMode.length && (
              <div className="pt-3 border-t">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Payment Mode</p>
                {stats.byPaymentMode.map(m => (
                  <div key={m.paymentMode} className="flex justify-between text-sm py-0.5">
                    <span className="text-gray-700">{m.paymentMode} <span className="text-xs text-gray-400">({m.count})</span></span>
                    <span className="tabular-nums">{formatRevenue(m.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top tests */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Top Tests ({periodLabel})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-gray-400 text-center py-8 text-sm">Loading…</p>
            ) : !stats?.topTests.length ? (
              <p className="text-gray-500 text-center py-8 text-sm">No tests billed in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-medium">Test</th>
                      <th className="text-left px-4 py-3 font-medium">Department</th>
                      <th className="text-right px-4 py-3 font-medium">Count</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stats.topTests.map(t => (
                      <tr key={t.testName}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{t.testName}</td>
                        <td className="px-4 py-2.5 text-gray-500">{t.department || "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{t.count}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatRevenue(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bills in period */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Diagnostics Bills ({periodLabel})</CardTitle>
          <button onClick={() => navigate("/diagnostics/search")} className="text-xs text-blue-600 hover:underline">
            View all →
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-gray-400 text-center py-8 text-sm">Loading…</p>
          ) : !stats?.recentBills.length ? (
            <p className="text-gray-500 text-center py-8 text-sm">No diagnostics bills in this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Bill No</th>
                    <th className="text-left px-4 py-3 font-medium">Patient</th>
                    <th className="text-left px-4 py-3 font-medium">Tests</th>
                    <th className="text-left px-4 py-3 font-medium">Bill Date</th>
                    <th className="text-left px-4 py-3 font-medium">Mode</th>
                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.recentBills.map(b => (
                    <tr key={b._id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/diagnostics/edit/${b._id}`)}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.billNo}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{b.title} {b.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{(b.tests || []).map(t => t.testName).join(", ")}</td>
                      <td className="px-4 py-3 text-gray-500 tabular-nums">{formatDate(b.billDate)}</td>
                      <td className="px-4 py-3 text-gray-500">{b.paymentMode}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">{formatRevenue(b.billAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
