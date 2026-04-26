import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, TrendingUp, TrendingDown, Minus } from "lucide-react";
import opdService from "@/services/opdService";

interface Stats {
  admissions: { today: number; yesterday: number };
  revenue:    { today: number; yesterday: number };
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
      : { text: "No activity yet", icon: null, color: "text-gray-400" };
  }
  const p = Math.round(((today - yesterday) / yesterday) * 100);
  if (p > 0)  return { text: `${p}% from yesterday`, icon: "up",   color: "text-green-600" };
  if (p < 0)  return { text: `${Math.abs(p)}% from yesterday`, icon: "down", color: "text-red-500" };
  return { text: "Same as yesterday", icon: "flat", color: "text-gray-500" };
}

function formatRevenue(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

const STATUS_STYLE: Record<string, string> = {
  Paid:      "bg-green-100 text-green-700",
  Pending:   "bg-yellow-100 text-yellow-700",
  Cancelled: "bg-red-100 text-red-600",
};

export default function Dashboard() {
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actLoading, setActLoading] = useState(true);

  useEffect(() => {
    opdService.getDashboardStats()
      .then(r => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    opdService.getTodayActivity()
      .then(r => setActivity(r.data.data.activity))
      .catch(() => {})
      .finally(() => setActLoading(false));
  }, []);

  const admChange = stats ? pctChange(stats.admissions.today, stats.admissions.yesterday) : null;
  const revChange = stats ? pctChange(stats.revenue.today,    stats.revenue.yesterday)    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Hospital Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's today's overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* OPD Admissions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">OPD Admissions Today</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {loading ? "—" : stats?.admissions.today ?? 0}
            </div>
            {admChange && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${admChange.color}`}>
                {admChange.icon === "up"   && <TrendingUp   className="h-3 w-3" />}
                {admChange.icon === "down" && <TrendingDown className="h-3 w-3" />}
                {admChange.icon === "flat" && <Minus        className="h-3 w-3" />}
                {admChange.icon === "up" || admChange.icon === "down" ? (admChange.icon === "up" ? "↑ " : "↓ ") : ""}
                {admChange.text}
              </p>
            )}
            {!stats && !loading && <p className="text-xs mt-1 text-gray-400">Could not load</p>}
          </CardContent>
        </Card>

        {/* Yesterday's Admissions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">OPD Admissions Yesterday</CardTitle>
            <Calendar className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {loading ? "—" : stats?.admissions.yesterday ?? 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Previous day total</p>
          </CardContent>
        </Card>

        {/* Revenue Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">OPD Revenue Today</CardTitle>
            <span className="text-emerald-600 font-bold text-lg">₹</span>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {loading ? "—" : formatRevenue(stats?.revenue.today ?? 0)}
            </div>
            {revChange && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${revChange.color}`}>
                {revChange.icon === "up"   && <TrendingUp   className="h-3 w-3" />}
                {revChange.icon === "down" && <TrendingDown className="h-3 w-3" />}
                {revChange.icon === "flat" && <Minus        className="h-3 w-3" />}
                {revChange.icon === "up" || revChange.icon === "down" ? (revChange.icon === "up" ? "↑ " : "↓ ") : ""}
                {revChange.text}
              </p>
            )}
            {!loading && stats && (
              <p className="text-xs text-gray-400 mt-0.5">
                Yesterday: {formatRevenue(stats.revenue.yesterday)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's Patient Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Today's Patient Activity</CardTitle>
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
                        <div className="font-medium text-gray-900">
                          {row.patient?.name ?? "—"}
                        </div>
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
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[row.status] ?? "bg-gray-100 text-gray-600"}`}>
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
    </div>
  );
}
