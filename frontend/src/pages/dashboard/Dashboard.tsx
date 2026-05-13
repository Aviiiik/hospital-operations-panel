import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, TrendingUp, TrendingDown, Minus, BedDouble, LogIn, LogOut, BedSingle, IndianRupee } from "lucide-react";
import opdService from "@/services/opdService";
import ipdService from "@/services/ipdService";

interface OpdStats {
  admissions: { today: number; yesterday: number };
  revenue:    { today: number; yesterday: number };
}

interface IpdStats {
  currentlyAdmitted: number;
  admittedToday:     number;
  dischargedToday:   number;
  bedsOccupied:      number;
  revenueToday:      number;
  recentAdmissions:  RecentAdmission[];
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

function pctChange(today: number, yesterday: number) {
  if (yesterday === 0) {
    return today > 0
      ? { text: "No data yesterday", icon: null, color: "text-gray-500" }
      : { text: "No activity yet",   icon: null, color: "text-gray-400" };
  }
  const p = Math.round(((today - yesterday) / yesterday) * 100);
  if (p > 0)  return { text: `${p}% from yesterday`,         icon: "up",   color: "text-green-600" };
  if (p < 0)  return { text: `${Math.abs(p)}% from yesterday`, icon: "down", color: "text-red-500" };
  return       { text: "Same as yesterday",                    icon: "flat", color: "text-gray-500" };
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

function TrendBadge({ today, yesterday }: { today: number; yesterday: number }) {
  const c = pctChange(today, yesterday);
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

  const [opdStats,   setOpdStats]   = useState<OpdStats | null>(null);
  const [ipdStats,   setIpdStats]   = useState<IpdStats | null>(null);
  const [activity,   setActivity]   = useState<ActivityRow[]>([]);
  const [opdLoading, setOpdLoading] = useState(true);
  const [ipdLoading, setIpdLoading] = useState(true);
  const [actLoading, setActLoading] = useState(true);

  useEffect(() => {
    opdService.getDashboardStats()
      .then(r => setOpdStats(r.data.data))
      .catch(() => {})
      .finally(() => setOpdLoading(false));

    ipdService.getDashboardStats()
      .then(r => setIpdStats(r.data.data))
      .catch(() => {})
      .finally(() => setIpdLoading(false));

    opdService.getTodayActivity()
      .then(r => setActivity(r.data.data.activity))
      .catch(() => {})
      .finally(() => setActLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Hospital Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's today's overview</p>
      </div>

      {/* ── OPD Stats ───────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">OPD</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Admissions Today</CardTitle>
              <Users className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{opdLoading ? "—" : opdStats?.admissions.today ?? 0}</div>
              {opdStats && <TrendBadge today={opdStats.admissions.today} yesterday={opdStats.admissions.yesterday} />}
              {!opdStats && !opdLoading && <p className="text-xs mt-1 text-gray-400">Could not load</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Admissions Yesterday</CardTitle>
              <Calendar className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{opdLoading ? "—" : opdStats?.admissions.yesterday ?? 0}</div>
              <p className="text-xs text-gray-500 mt-1">Previous day total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue Today</CardTitle>
              <span className="text-emerald-600 font-bold text-lg">₹</span>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{opdLoading ? "—" : formatRevenue(opdStats?.revenue.today ?? 0)}</div>
              {opdStats && <TrendBadge today={opdStats.revenue.today} yesterday={opdStats.revenue.yesterday} />}
              {!opdLoading && opdStats && (
                <p className="text-xs text-gray-400 mt-0.5">Yesterday: {formatRevenue(opdStats.revenue.yesterday)}</p>
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
              <p className="text-xs text-gray-500 mt-1">Active patients</p>
            </CardContent>
          </Card>

          <Card className="border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Admitted Today</CardTitle>
              <LogIn className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700">
                {ipdLoading ? "—" : ipdStats?.admittedToday ?? 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">New admissions</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Discharged Today</CardTitle>
              <LogOut className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {ipdLoading ? "—" : ipdStats?.dischargedToday ?? 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Today's discharges</p>
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
              <p className="text-xs text-gray-500 mt-1">Assigned beds</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue Today</CardTitle>
              <IndianRupee className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-700">
                {ipdLoading ? "—" : formatRevenue(ipdStats?.revenueToday ?? 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Receipts collected</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent IPD admissions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent IPD Patients</CardTitle>
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
              <p className="text-gray-500 text-center py-8 text-sm">No IPD patients yet</p>
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

      {/* ── OPD Today's Activity ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">OPD — Today's Activity</h2>
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
              <p className="text-gray-500 text-center py-12 text-sm">No bookings recorded today</p>
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
    </div>
  );
}
