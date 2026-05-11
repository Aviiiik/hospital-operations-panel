import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Printer, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import ipdService from "@/services/ipdService";
import logoUrl from "@/assets/logo.png";

interface BillingEntry {
  _id: string;
  serviceGroup: string;
  serviceGroupCode: string;
  serviceName: string;
  unit: string;
  quantity: number;
  unitCharge: number;
  discount: number;
  totalCharge: number;
  date: string;
  doctorName?: string;
}

interface Investigation {
  _id: string;
  reqNo: string;
  reqDate: string;
  vendor?: string;
  vendorBillNo?: string;
  totalAmount: number;
}

function fmt(n: number) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function fmtDate(d: string | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Shared print styles ───────────────────────────────────────────────────────
const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 24px; }
  h1  { font-size: 22px; font-weight: bold; color: #b91c1c; letter-spacing: 0.03em; }
  h2  { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em;
        color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 14px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
  th  { background: #f3f4f6; padding: 5px 8px; text-align: left; border: 1px solid #d1d5db; font-size: 10px; text-transform: uppercase; }
  td  { padding: 4px 8px; border: 1px solid #e5e7eb; }
  .right  { text-align: right; }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  .sub    { color: #6b7280; }
  .total-row { background: #f9fafb; font-weight: bold; }
  .header { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2px solid #374151; padding-bottom: 12px; margin-bottom: 14px; }
  .header-right { text-align: right; }
  .header-right .bill-type { font-size: 20px; font-weight: bold; color: #b91c1c; }
  .header-right .bill-sub  { font-size: 10px; color: #9ca3af; margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 32px;
               border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px; }
  .info-label { font-size: 10px; color: #6b7280; }
  .info-val   { font-weight: 600; font-size: 12px; }
  .totals-box { display: flex; justify-content: flex-end; margin-top: 8px; }
  .totals-inner { min-width: 220px; }
  .totals-row   { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
  .totals-grand { display: flex; justify-content: space-between; padding: 6px 0 0;
                  border-top: 2px solid #111; font-size: 14px; font-weight: bold; margin-top: 4px; }
  .grand-card   { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px;
                  padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
  .grand-label  { font-size: 14px; font-weight: bold; color: #1d4ed8; }
  .grand-amount { font-size: 22px; font-weight: bold; color: #1e40af; }
  .grand-sub    { font-size: 10px; color: #93c5fd; margin-top: 2px; }
  .signatures   { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-line     { border-top: 1px solid #9ca3af; padding-top: 4px; width: 150px; text-align: center; font-size: 11px; color: #4b5563; }
  .discharge-row{ margin-top: 16px; padding-top: 10px; border-top: 1px solid #e5e7eb;
                  font-size: 11px; color: #6b7280; display: flex; gap: 32px; }
  @media print { body { padding: 12px; } }
`;

function openPrintWindow(title: string, body: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { toast.error("Pop-up blocked — allow pop-ups and try again"); return; }
  w.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
${body}
<script>window.onload=function(){window.focus();window.print();setTimeout(()=>window.close(),500);}<\/script>
</body></html>`);
  w.document.close();
}

// ── Print: Estimated Bill ─────────────────────────────────────────────────────
function buildEstimatedHtml(
  patient: any,
  serviceGroups: Record<string, { gross: number; discount: number; net: number }>,
  investigations: Investigation[],
  servicesGross: number, servicesDiscount: number, servicesNet: number,
  invTotal: number, grandTotal: number,
) {
  const svcRows = Object.entries(serviceGroups).map(([grp, d]) => `
    <tr>
      <td>${grp}</td>
      <td class="right sub">${fmt(d.gross)}</td>
      <td class="right sub">${d.discount > 0 ? `<span style="color:#ef4444">${fmt(d.discount)}</span>` : "—"}</td>
      <td class="right bold">${fmt(d.net)}</td>
    </tr>`).join("");

  const invRows = investigations.map(inv => `
    <tr>
      <td style="font-family:monospace">${inv.reqNo}</td>
      <td>${fmtDate(inv.reqDate)}</td>
      <td>${inv.vendor || "—"}</td>
      <td class="right bold">${fmt(inv.totalAmount || 0)}</td>
    </tr>`).join("");

  return `
<div class="header">
  <div>
    <h1>Arogya Maternal &amp; Nursing Home</h1>
    <div style="font-size:11px;color:#6b7280;margin-top:4px">IPD Billing</div>
  </div>
  <div class="header-right">
    <div class="bill-type">ESTIMATED BILL</div>
    <div class="bill-sub">Generated: ${new Date().toLocaleDateString("en-IN")}</div>
  </div>
</div>

<div class="info-grid">
  <div><div class="info-label">Patient Name</div><div class="info-val">${patient.title} ${patient.name}</div></div>
  <div><div class="info-label">Admission ID</div><div class="info-val" style="font-family:monospace">${patient.admissionId}</div></div>
  <div><div class="info-label">Age / Sex</div><div class="info-val">${patient.ageYears ? patient.ageYears + "Y " : ""}${patient.ageMonths ? patient.ageMonths + "M" : ""} / ${patient.gender || "—"}</div></div>
  <div><div class="info-label">Phone</div><div class="info-val">${patient.phone || "—"}</div></div>
  <div><div class="info-label">Bed</div><div class="info-val">${patient.bedNo || "—"}${patient.bedCategory ? " (" + patient.bedCategory + ")" : ""}</div></div>
  <div><div class="info-label">Department</div><div class="info-val">${patient.department || "—"}</div></div>
  <div><div class="info-label">Admitted</div><div class="info-val">${fmtDate(patient.admissionDate)} ${patient.admissionTime || ""}</div></div>
  <div><div class="info-label">Status</div><div class="info-val" style="color:${patient.status === "Admitted" ? "#16a34a" : "#ea580c"}">${patient.status}</div></div>
</div>

<h2>Services</h2>
${Object.keys(serviceGroups).length === 0 ? "<p style='color:#9ca3af;font-size:11px'>No service entries.</p>" : `
<table>
  <thead><tr><th>Service Group</th><th class="right">Gross</th><th class="right">Discount</th><th class="right">Net</th></tr></thead>
  <tbody>
    ${svcRows}
    <tr class="total-row">
      <td>Services Subtotal</td>
      <td class="right">${fmt(servicesGross)}</td>
      <td class="right" style="color:#ef4444">${servicesDiscount > 0 ? fmt(servicesDiscount) : "—"}</td>
      <td class="right">${fmt(servicesNet)}</td>
    </tr>
  </tbody>
</table>`}

<h2>Investigations</h2>
${investigations.length === 0 ? "<p style='color:#9ca3af;font-size:11px'>No investigations.</p>" : `
<table>
  <thead><tr><th>Req No</th><th>Date</th><th>Vendor</th><th class="right">Amount</th></tr></thead>
  <tbody>
    ${invRows}
    <tr class="total-row">
      <td colspan="3">Investigations Subtotal</td>
      <td class="right">${fmt(invTotal)}</td>
    </tr>
  </tbody>
</table>`}

<div class="grand-card">
  <div>
    <div class="grand-label">Estimated Grand Total</div>
    <div class="grand-sub">Services ${fmt(servicesNet)} + Investigations ${fmt(invTotal)}</div>
  </div>
  <div class="grand-amount">${fmt(grandTotal)}</div>
</div>

<div style="margin-top:30px;font-size:10px;color:#9ca3af;text-align:center">
  This is an estimated bill. Final amount may vary.
</div>`;
}

// ── Print: Final Bill ─────────────────────────────────────────────────────────
function buildFinalHtml(
  patient: any,
  entries: BillingEntry[],
  investigations: Investigation[],
  servicesGross: number, servicesDiscount: number, servicesNet: number,
  invTotal: number, grandTotal: number,
  logo: string,
) {
  const svcRows = entries.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${e.serviceName}</td>
      <td class="sub">${e.serviceGroup}</td>
      <td class="center">${e.quantity}</td>
      <td class="right">${fmt(e.unitCharge)}</td>
      <td class="right">${e.discount ? `<span style="color:#ef4444">${fmt(e.discount)}</span>` : "—"}</td>
      <td class="right bold">${fmt(e.totalCharge)}</td>
    </tr>`).join("");

  const invRows = investigations.map((inv, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-family:monospace">${inv.reqNo}</td>
      <td>${fmtDate(inv.reqDate)}</td>
      <td>${inv.vendor || "—"}</td>
      <td class="right bold">${fmt(inv.totalAmount || 0)}</td>
    </tr>`).join("");

  const doctors = patient.doctors?.length
    ? patient.doctors.map((d: any) => d.doctorName).join(", ")
    : "—";

  return `
<div class="header">
  <img src="${logo}" alt="Logo" style="height:60px;object-fit:contain"/>
  <div class="header-right">
    <div class="bill-type">FINAL BILL</div>
    <div class="bill-sub">Arogya Maternal &amp; Nursing Home</div>
  </div>
</div>

<div class="info-grid">
  <div><div class="info-label">Patient Name</div><div class="info-val">${patient.title} ${patient.name}</div></div>
  <div><div class="info-label">Admission ID</div><div class="info-val" style="font-family:monospace">${patient.admissionId}</div></div>
  <div><div class="info-label">Age / Sex</div><div class="info-val">${patient.ageYears ? patient.ageYears + "Y " : ""}${patient.ageMonths ? patient.ageMonths + "M " : ""}${patient.ageDays ? patient.ageDays + "D" : ""} / ${patient.gender || "—"}</div></div>
  <div><div class="info-label">Phone</div><div class="info-val">${patient.phone || "—"}</div></div>
  <div><div class="info-label">Admitted</div><div class="info-val">${fmtDate(patient.admissionDate)} ${patient.admissionTime || ""}</div></div>
  <div><div class="info-label">Discharged</div><div class="info-val">${fmtDate(patient.dischargeDate)} ${patient.dischargeTime || ""}</div></div>
  <div><div class="info-label">Bed</div><div class="info-val">${patient.bedNo || "—"}${patient.bedCategory ? " (" + patient.bedCategory + ")" : ""}</div></div>
  <div><div class="info-label">Department</div><div class="info-val">${patient.department || "—"}</div></div>
  <div style="grid-column:1/-1"><div class="info-label">Under Doctor</div><div class="info-val">${doctors}</div></div>
  ${patient.patientCategory ? `<div><div class="info-label">Category</div><div class="info-val">${patient.patientCategory}</div></div>` : ""}
</div>

<h2>Services</h2>
<table>
  <thead><tr><th>#</th><th>Service</th><th>Group</th><th class="center">Qty</th><th class="right">Unit Rate</th><th class="right">Discount</th><th class="right">Amount</th></tr></thead>
  <tbody>
    ${svcRows}
    <tr class="total-row">
      <td colspan="5">Services Total</td>
      <td class="right" style="color:#ef4444">${servicesDiscount > 0 ? fmt(servicesDiscount) : "—"}</td>
      <td class="right">${fmt(servicesNet)}</td>
    </tr>
  </tbody>
</table>

${investigations.length > 0 ? `
<h2>Investigations</h2>
<table>
  <thead><tr><th>#</th><th>Req No</th><th>Date</th><th>Vendor</th><th class="right">Amount</th></tr></thead>
  <tbody>
    ${invRows}
    <tr class="total-row">
      <td colspan="4">Investigations Total</td>
      <td class="right">${fmt(invTotal)}</td>
    </tr>
  </tbody>
</table>` : ""}

<div class="totals-box">
  <div class="totals-inner">
    <div class="totals-row"><span>Services Net</span><span class="bold">${fmt(servicesNet)}</span></div>
    ${investigations.length > 0 ? `<div class="totals-row"><span>Investigations</span><span class="bold">${fmt(invTotal)}</span></div>` : ""}
    <div class="totals-grand"><span>Grand Total</span><span>${fmt(grandTotal)}</span></div>
  </div>
</div>

<div class="discharge-row">
  <span>Discharge Type: ${patient.dischargeType || "—"}</span>
  ${patient.referredTo ? `<span>Referred To: ${patient.referredTo}</span>` : ""}
</div>

<div class="signatures">
  <div><div class="sig-line">Patient / Guardian</div></div>
  <div><div class="sig-line">Authorised Signatory</div></div>
</div>`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function IpdBilling() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient,        setPatient]        = useState<any>(null);
  const [entries,        setEntries]        = useState<BillingEntry[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      ipdService.getPatient(id),
      ipdService.getBillingEntries(id),
      ipdService.getInvestigations(id),
    ])
      .then(([pRes, bRes, iRes]) => {
        setPatient(pRes.data.data);
        setEntries(bRes.data.data.entries || []);
        setInvestigations(iRes.data.data.investigations || []);
      })
      .catch(() => toast.error("Failed to load billing data"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  if (!patient) return <div className="flex items-center justify-center h-64 text-red-500">Patient not found</div>;

  // ── Derived totals ────────────────────────────────────────────────────────────

  const serviceGroups = entries.reduce<
    Record<string, { entries: BillingEntry[]; gross: number; discount: number; net: number }>
  >((acc, e) => {
    const key = e.serviceGroup || "Other";
    if (!acc[key]) acc[key] = { entries: [], gross: 0, discount: 0, net: 0 };
    acc[key].entries.push(e);
    acc[key].gross    += e.unitCharge * e.quantity;
    acc[key].discount += e.discount   || 0;
    acc[key].net      += e.totalCharge;
    return acc;
  }, {});

  const servicesGross    = entries.reduce((s, e) => s + e.unitCharge * e.quantity, 0);
  const servicesDiscount = entries.reduce((s, e) => s + (e.discount || 0), 0);
  const servicesNet      = entries.reduce((s, e) => s + e.totalCharge, 0);
  const invTotal         = investigations.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const grandTotal       = servicesNet + invTotal;

  const handlePrintEstimated = () =>
    openPrintWindow(
      `Estimated Bill — ${patient.admissionId}`,
      buildEstimatedHtml(patient, serviceGroups, investigations, servicesGross, servicesDiscount, servicesNet, invTotal, grandTotal),
    );

  const handlePrintFinal = () =>
    openPrintWindow(
      `Final Bill — ${patient.admissionId}`,
      buildFinalHtml(patient, entries, investigations, servicesGross, servicesDiscount, servicesNet, invTotal, grandTotal, logoUrl),
    );

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/ipd/edit/${id}`)} className="h-9 w-9">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">IPD — Billing</h1>
          <p className="text-gray-500 text-sm font-mono">{patient.admissionId}</p>
        </div>
      </div>

      <Tabs defaultValue="estimated">
        <TabsList>
          <TabsTrigger value="estimated">Estimated Billing</TabsTrigger>
          <TabsTrigger value="final">Final Bill</TabsTrigger>
        </TabsList>

        {/* ── Estimated Billing ─────────────────────────────────────────────────── */}
        <TabsContent value="estimated" className="space-y-4 mt-4">
          {/* Patient summary */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm flex-1">
                  <div>
                    <span className="text-gray-500 block text-xs">Patient</span>
                    <span className="font-semibold">{patient.title} {patient.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Admission ID</span>
                    <span className="font-mono font-semibold">{patient.admissionId}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Bed</span>
                    <span className="font-semibold">{patient.bedNo || "—"} {patient.bedCategory ? `(${patient.bedCategory})` : ""}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Status</span>
                    <span className={`font-semibold ${patient.status === "Admitted" ? "text-green-600" : "text-orange-600"}`}>
                      {patient.status}
                    </span>
                  </div>
                </div>
                <Button onClick={handlePrintEstimated} variant="outline" className="gap-2 shrink-0">
                  <Printer className="h-4 w-4" /> Print
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Services breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Services</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {Object.keys(serviceGroups).length === 0 ? (
                <p className="px-6 py-4 text-sm text-gray-400">No service entries yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="text-left px-4 py-2 font-medium">Service Group</th>
                      <th className="text-right px-4 py-2 font-medium">Gross</th>
                      <th className="text-right px-4 py-2 font-medium">Discount</th>
                      <th className="text-right px-4 py-2 font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(serviceGroups).map(([grp, data]) => (
                      <tr key={grp} className="border-t">
                        <td className="px-4 py-2">{grp}</td>
                        <td className="text-right px-4 py-2 text-gray-600">{fmt(data.gross)}</td>
                        <td className="text-right px-4 py-2 text-red-500">
                          {data.discount > 0 ? fmt(data.discount) : "—"}
                        </td>
                        <td className="text-right px-4 py-2 font-medium">{fmt(data.net)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-gray-50 font-semibold">
                      <td className="px-4 py-2">Services Subtotal</td>
                      <td className="text-right px-4 py-2 text-gray-600">{fmt(servicesGross)}</td>
                      <td className="text-right px-4 py-2 text-red-500">
                        {servicesDiscount > 0 ? fmt(servicesDiscount) : "—"}
                      </td>
                      <td className="text-right px-4 py-2">{fmt(servicesNet)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Investigations breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Investigations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {investigations.length === 0 ? (
                <p className="px-6 py-4 text-sm text-gray-400">No investigations yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="text-left px-4 py-2 font-medium">Req No</th>
                      <th className="text-left px-4 py-2 font-medium">Date</th>
                      <th className="text-left px-4 py-2 font-medium">Vendor</th>
                      <th className="text-right px-4 py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investigations.map(inv => (
                      <tr key={inv._id} className="border-t">
                        <td className="px-4 py-2 font-mono text-xs">{inv.reqNo}</td>
                        <td className="px-4 py-2">{fmtDate(inv.reqDate)}</td>
                        <td className="px-4 py-2">{inv.vendor || "—"}</td>
                        <td className="text-right px-4 py-2 font-medium">{fmt(inv.totalAmount || 0)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-gray-50 font-semibold">
                      <td colSpan={3} className="px-4 py-2">Investigations Subtotal</td>
                      <td className="text-right px-4 py-2">{fmt(invTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Grand total */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-blue-800">Estimated Grand Total</p>
                  <p className="text-xs text-blue-500 mt-0.5">
                    Services {fmt(servicesNet)} + Investigations {fmt(invTotal)}
                  </p>
                </div>
                <p className="text-3xl font-bold text-blue-700">{fmt(grandTotal)}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Final Bill ────────────────────────────────────────────────────────── */}
        <TabsContent value="final" className="mt-4">
          {patient.status !== "Discharged" ? (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-10 pb-10 flex flex-col items-center gap-3">
                <IndianRupee className="h-12 w-12 text-orange-400" />
                <p className="text-lg font-semibold text-orange-800">Patient not yet discharged</p>
                <p className="text-sm text-orange-600">Final bill will be available after discharge.</p>
                <Button variant="outline" className="mt-2 border-orange-300 text-orange-700 hover:bg-orange-100"
                  onClick={() => navigate(`/ipd/discharge/${id}`)}>
                  Go to Discharge
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Print button */}
              <div className="flex justify-end mb-4">
                <Button onClick={handlePrintFinal} className="bg-red-600 hover:bg-red-700 gap-2">
                  <Printer className="h-4 w-4" /> Print Final Bill
                </Button>
              </div>

              {/* Bill preview */}
              <div className="bg-white border rounded-lg p-8">
                {/* Hospital header */}
                <div className="flex items-start justify-between pb-4 mb-4 border-b-2 border-gray-300">
                  <img src={logoUrl} alt="Logo" className="h-16 object-contain" />
                  <div className="text-right">
                    <h2 className="text-2xl font-bold text-red-700 tracking-wide">FINAL BILL</h2>
                    <p className="text-xs text-gray-400 mt-1">Arogya Maternal &amp; Nursing Home</p>
                  </div>
                </div>

                {/* Patient info */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm mb-5 pb-4 border-b">
                  <div><span className="text-gray-500 inline-block w-36">Patient Name:</span><span className="font-semibold">{patient.title} {patient.name}</span></div>
                  <div><span className="text-gray-500 inline-block w-36">Admission ID:</span><span className="font-mono font-semibold">{patient.admissionId}</span></div>
                  <div>
                    <span className="text-gray-500 inline-block w-36">Age / Sex:</span>
                    <span>{patient.ageYears ? `${patient.ageYears}Y ` : ""}{patient.ageMonths ? `${patient.ageMonths}M ` : ""}{patient.ageDays ? `${patient.ageDays}D` : ""} / {patient.gender || "—"}</span>
                  </div>
                  <div><span className="text-gray-500 inline-block w-36">Phone:</span><span>{patient.phone || "—"}</span></div>
                  <div><span className="text-gray-500 inline-block w-36">Admission:</span><span>{fmtDate(patient.admissionDate)} {patient.admissionTime || ""}</span></div>
                  <div><span className="text-gray-500 inline-block w-36">Discharge:</span><span>{fmtDate(patient.dischargeDate)} {patient.dischargeTime || ""}</span></div>
                  <div><span className="text-gray-500 inline-block w-36">Bed:</span><span>{patient.bedNo || "—"} {patient.bedCategory ? `(${patient.bedCategory})` : ""}</span></div>
                  <div><span className="text-gray-500 inline-block w-36">Department:</span><span>{patient.department || "—"}</span></div>
                  {patient.doctors?.length > 0 && (
                    <div className="col-span-2"><span className="text-gray-500 inline-block w-36">Under Doctor:</span><span>{patient.doctors.map((d: any) => d.doctorName).join(", ")}</span></div>
                  )}
                  {patient.patientCategory && (
                    <div><span className="text-gray-500 inline-block w-36">Category:</span><span>{patient.patientCategory}</span></div>
                  )}
                </div>

                {/* Services table */}
                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Services</h3>
                <table className="w-full text-xs mb-5 border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1.5 text-left">#</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-left">Service</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-left">Group</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center">Qty</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-right">Unit Rate</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-right">Discount</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={e._id}>
                        <td className="border border-gray-200 px-2 py-1">{i + 1}</td>
                        <td className="border border-gray-200 px-2 py-1">{e.serviceName}</td>
                        <td className="border border-gray-200 px-2 py-1 text-gray-500">{e.serviceGroup}</td>
                        <td className="border border-gray-200 px-2 py-1 text-center">{e.quantity}</td>
                        <td className="border border-gray-200 px-2 py-1 text-right">{fmt(e.unitCharge)}</td>
                        <td className="border border-gray-200 px-2 py-1 text-right">{e.discount ? fmt(e.discount) : "—"}</td>
                        <td className="border border-gray-200 px-2 py-1 text-right font-medium">{fmt(e.totalCharge)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={5} className="border border-gray-300 px-2 py-1.5">Services Total</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right text-red-600">{servicesDiscount > 0 ? fmt(servicesDiscount) : "—"}</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right">{fmt(servicesNet)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Investigations table */}
                {investigations.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Investigations</h3>
                    <table className="w-full text-xs mb-5 border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-2 py-1.5 text-left">#</th>
                          <th className="border border-gray-300 px-2 py-1.5 text-left">Req No</th>
                          <th className="border border-gray-300 px-2 py-1.5 text-left">Date</th>
                          <th className="border border-gray-300 px-2 py-1.5 text-left">Vendor</th>
                          <th className="border border-gray-300 px-2 py-1.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {investigations.map((inv, i) => (
                          <tr key={inv._id}>
                            <td className="border border-gray-200 px-2 py-1">{i + 1}</td>
                            <td className="border border-gray-200 px-2 py-1 font-mono">{inv.reqNo}</td>
                            <td className="border border-gray-200 px-2 py-1">{fmtDate(inv.reqDate)}</td>
                            <td className="border border-gray-200 px-2 py-1">{inv.vendor || "—"}</td>
                            <td className="border border-gray-200 px-2 py-1 text-right font-medium">{fmt(inv.totalAmount || 0)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-semibold">
                          <td colSpan={4} className="border border-gray-300 px-2 py-1.5">Investigations Total</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-right">{fmt(invTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}

                {/* Grand total */}
                <div className="flex justify-end mt-2">
                  <div className="min-w-64 space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Services Net</span><span className="font-medium">{fmt(servicesNet)}</span></div>
                    {investigations.length > 0 && (
                      <div className="flex justify-between text-sm"><span className="text-gray-600">Investigations</span><span className="font-medium">{fmt(invTotal)}</span></div>
                    )}
                    <div className="flex justify-between text-base font-bold border-t-2 border-gray-900 pt-2 mt-1"><span>Grand Total</span><span>{fmt(grandTotal)}</span></div>
                  </div>
                </div>

                {/* Discharge info */}
                <div className="mt-6 pt-3 border-t text-xs text-gray-500 flex gap-8">
                  <span>Discharge Type: {patient.dischargeType || "—"}</span>
                  {patient.referredTo && <span>Referred To: {patient.referredTo}</span>}
                </div>

                {/* Signatures */}
                <div className="mt-10 flex justify-between text-sm text-gray-600">
                  <div><div className="border-t border-gray-400 pt-1 w-40 text-center">Patient / Guardian</div></div>
                  <div><div className="border-t border-gray-400 pt-1 w-40 text-center">Authorised Signatory</div></div>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
