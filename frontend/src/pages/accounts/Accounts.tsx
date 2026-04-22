// src/pages/accounts/Accounts.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, TrendingDown, Users, Bed, Pill, TestTube } from "lucide-react";
import { toast } from "sonner";

interface RevenueData {
  date: string;
  opd: number;
  ipd: number;
  pharmacy: number;
  lab: number;
  total: number;
}

export default function Accounts() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);

  const totalRevenue = revenueData.reduce((sum, day) => sum + day.total, 0);
  const avgDailyRevenue = revenueData.length ? Math.round(totalRevenue / revenueData.length) : 0;

  // Mock Data
  useEffect(() => {
    setLoading(true);
    
    const mockData: RevenueData[] = [
      { date: "2026-03-20", opd: 125000, ipd: 450000, pharmacy: 89000, lab: 67000, total: 731000 },
      { date: "2026-03-21", opd: 98000,  ipd: 520000, pharmacy: 112000, lab: 45000, total: 775000 },
      { date: "2026-03-22", opd: 145000, ipd: 380000, pharmacy: 98000, lab: 89000, total: 712000 },
      { date: "2026-03-23", opd: 112000, ipd: 490000, pharmacy: 75000, lab: 125000, total: 802000 },
      { date: "2026-03-24", opd: 135000, ipd: 410000, pharmacy: 105000, lab: 67000, total: 717000 },
      { date: "2026-03-25", opd: 98000,  ipd: 550000, pharmacy: 92000, lab: 98000, total: 838000 },
    ];

    setTimeout(() => {
      setRevenueData(mockData);
      setLoading(false);
    }, 600);
  }, [period]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getGrowth = () => {
    if (revenueData.length < 2) return 0;
    const latest = revenueData[revenueData.length - 1].total;
    const previous = revenueData[revenueData.length - 2].total;
    return ((latest - previous) / previous) * 100;
  };

  const growth = getGrowth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-lg">Loading Accounts Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hospital Accounts</h1>
          <p className="text-gray-500 mt-1">Revenue Overview & Financial Insights</p>
        </div>

        <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalRevenue)}</div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              {growth > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={growth > 0 ? "text-green-600" : "text-red-600"}>
                {growth.toFixed(1)}% from previous period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Avg Daily Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(avgDailyRevenue)}</div>
            <p className="text-xs text-gray-500 mt-2">This {period}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">OPD Revenue</CardTitle>
            <Users className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(revenueData.reduce((sum, d) => sum + d.opd, 0))}
            </div>
            <Badge variant="secondary" className="mt-2">Outpatient</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">IPD Revenue</CardTitle>
            <Bed className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(revenueData.reduce((sum, d) => sum + d.ipd, 0))}
            </div>
            <Badge variant="secondary" className="mt-2">Inpatient</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Revenue Trend ({period.toUpperCase()})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {revenueData.map((day, index) => (
                <div key={index} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div>
                    <p className="font-medium">{new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    <p className="text-sm text-gray-500">{formatCurrency(day.total)}</p>
                  </div>
                  <div className="text-right text-sm space-y-1">
                    <div>OPD: <span className="font-medium">{formatCurrency(day.opd)}</span></div>
                    <div>IPD: <span className="font-medium">{formatCurrency(day.ipd)}</span></div>
                    <div>Pharmacy: <span className="font-medium">{formatCurrency(day.pharmacy)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>OPD</span>
                <span className="font-medium">{formatCurrency(revenueData.reduce((s, d) => s + d.opd, 0))}</span>
              </div>
              <div className="h-2 bg-orange-200 rounded">
                <div className="h-2 bg-orange-600 rounded" style={{ width: "28%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>IPD</span>
                <span className="font-medium">{formatCurrency(revenueData.reduce((s, d) => s + d.ipd, 0))}</span>
              </div>
              <div className="h-2 bg-red-200 rounded">
                <div className="h-2 bg-red-600 rounded" style={{ width: "52%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Pharmacy</span>
                <span className="font-medium">{formatCurrency(revenueData.reduce((s, d) => s + d.pharmacy, 0))}</span>
              </div>
              <div className="h-2 bg-green-200 rounded">
                <div className="h-2 bg-green-600 rounded" style={{ width: "15%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Laboratory</span>
                <span className="font-medium">{formatCurrency(revenueData.reduce((s, d) => s + d.lab, 0))}</span>
              </div>
              <div className="h-2 bg-purple-200 rounded">
                <div className="h-2 bg-purple-600 rounded" style={{ width: "12%" }}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            Detailed transaction list will appear here.<br />
            <span className="text-sm">(Backend integration pending)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}