import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Printer, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import ipdService, { BED_CHARGES, computeBillingDays } from "@/services/ipdService";
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
  discountType: "flat" | "percent";
  totalCharge: number;
  date: string;
  doctorName?: string;
}

interface InvLineItem {
  slNo: number;
  code: string;
  description: string;
  amount: number;
  netAmount: number;
  category: string;
  remark: string;
}

interface Investigation {
  _id: string;
  reqNo: string;
  reqDate: string;
  vendor?: string;
  vendorBillNo?: string;
  totalAmount: number;
  items: InvLineItem[];
}

interface BedAllotment {
  _id: string;
  bedCategory: string;
  bedNo: string;
  charge: number;
  allotmentDate: string;
  allotmentTime?: string;
  endDate?: string;
  endTime?: string;
  isCurrent?: boolean;
}

interface PharmItem {
  itemName: string;
  package: string;
  qty: string | number;
  mrp: string | number;
  discount: string | number;
  discountType?: "%" | "₹";
  netAmount: number;
}

interface PharmBill {
  _id: string;
  billNo: string;
  vendorBillNo?: string;
  billDate: string;
  vendor?: string;
  referredBy?: string;
  items: PharmItem[];
  netAmount: number;
}

interface ReceiptSummary {
  totalReceived: number;
  totalTds: number;
  totalDisallowed: number;
  totalRefund: number;
  count: number;
}

function fmt(n: number) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}
function fmtDate(d: string | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Print styles ──────────────────────────────────────────────────────────────
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
  .totals-inner { min-width: 260px; }
  .totals-row   { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
  .totals-sep   { border-top: 1px solid #d1d5db; margin: 4px 0; }
  .totals-grand { display: flex; justify-content: space-between; padding: 6px 0 0;
                  border-top: 2px solid #111; font-size: 14px; font-weight: bold; margin-top: 4px; }
  .signatures   { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-line     { border-top: 1px solid #9ca3af; padding-top: 4px; width: 150px; text-align: center; font-size: 11px; color: #4b5563; }
  @media print { body { padding: 12px; } }
`;

function openPrintWindow(title: string, body: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { toast.error("Pop-up blocked — allow pop-ups and try again"); return; }
  w.document.write(`<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>${PRINT_CSS}</style>
</head><body>${body}
<script>window.onload=function(){window.focus();window.print();setTimeout(()=>window.close(),500);}<\/script>
</body></html>`);
  w.document.close();
}

function patientInfoBlock(patient: any) {
  const doctors = patient.doctors?.length
    ? patient.doctors.map((d: any) => d.doctorName).join(", ")
    : "—";
  return `
<div class="info-grid">
  <div><div class="info-label">Patient Name</div><div class="info-val">${patient.title} ${patient.name}</div></div>
  <div><div class="info-label">Admission ID</div><div class="info-val" style="font-family:monospace">${patient.admissionId}</div></div>
  <div><div class="info-label">Age / Sex</div><div class="info-val">${patient.ageYears ? patient.ageYears + "Y " : ""}${patient.ageMonths ? patient.ageMonths + "M " : ""}${patient.ageDays ? patient.ageDays + "D" : ""} / ${patient.gender || "—"}</div></div>
  <div><div class="info-label">Phone</div><div class="info-val">${patient.phone || "—"}</div></div>
  <div><div class="info-label">Admitted</div><div class="info-val">${fmtDate(patient.admissionDate)} ${patient.admissionTime || ""}</div></div>
  <div><div class="info-label">Discharged</div><div class="info-val">${fmtDate(patient.dischargeDate)} ${patient.dischargeTime || ""}</div></div>
  ${patient.address ? `<div style="grid-column:1/-1"><div class="info-label">Address</div><div class="info-val">${patient.address}</div></div>` : ""}
  <div style="grid-column:1/-1"><div class="info-label">Under Doctor</div><div class="info-val">${doctors}</div></div>
  ${patient.patientCategory ? `<div><div class="info-label">Patient Category</div><div class="info-val">${patient.patientCategory}</div></div>` : ""}
  ${patient.insuranceCo ? `<div><div class="info-label">Insurance Company</div><div class="info-val">${patient.insuranceCo}</div></div>` : ""}
  ${patient.tpa ? `<div><div class="info-label">TPA</div><div class="info-val">${patient.tpa}</div></div>` : ""}
</div>`;
}

function totalsBlock(
  totalBedCharge: number, servicesGross: number, invTotal: number, pharmTotal: number,
  servicesDiscount: number, billDiscAmt: number, grandTotal: number,
  receiptSummary: ReceiptSummary | null,
) {
  const totalPaid  = receiptSummary?.totalReceived ?? 0;
  const totalTds   = receiptSummary?.totalTds ?? 0;
  const totalDis   = receiptSummary?.totalDisallowed ?? 0;
  const preDisc    = totalBedCharge + servicesGross + invTotal + pharmTotal - servicesDiscount;
  const netDue     = Math.max(0, grandTotal - totalPaid - totalTds - totalDis);
  return `
<div class="totals-box">
  <div class="totals-inner">
    <div class="totals-row"><span>Total Bed Charge</span><span class="bold">${fmt(totalBedCharge)}</span></div>
    <div class="totals-row"><span>Nursing Home Charge</span><span class="bold">${fmt(servicesGross)}</span></div>
    ${invTotal > 0 ? `<div class="totals-row"><span>Investigations</span><span class="bold">${fmt(invTotal)}</span></div>` : ""}
    ${pharmTotal > 0 ? `<div class="totals-row"><span>Pharmacy</span><span class="bold">${fmt(pharmTotal)}</span></div>` : ""}
    <div class="totals-row"><span>Total Charge</span><span class="bold">${fmt(totalBedCharge + servicesGross + invTotal + pharmTotal)}</span></div>
    ${servicesDiscount > 0 ? `<div class="totals-row" style="color:#ef4444"><span>(-)Service Discount</span><span>${fmt(servicesDiscount)}</span></div>` : ""}
    <div class="totals-sep"></div>
    <div class="totals-row"><span>Net Total</span><span class="bold">${fmt(preDisc)}</span></div>
    ${billDiscAmt > 0 ? `<div class="totals-row" style="color:#ef4444"><span>(-)Bill Discount</span><span>${fmt(billDiscAmt)}</span></div>` : ""}
    <div class="totals-row"><span>Grand Total</span><span class="bold">${fmt(grandTotal)}</span></div>
    <div class="totals-row"><span>Total Paid Amount</span><span>${fmt(totalPaid)}</span></div>
    ${totalTds > 0 ? `<div class="totals-row"><span>TDS</span><span>${fmt(totalTds)}</span></div>` : ""}
    ${totalDis > 0 ? `<div class="totals-row"><span>Disallowed</span><span>${fmt(totalDis)}</span></div>` : ""}
    <div class="totals-grand"><span>Payable By Patient</span><span>${fmt(netDue)}</span></div>
  </div>
</div>
<div class="signatures">
  <div><div class="sig-line">Patient / Guardian</div></div>
  <div><div class="sig-line">Authorised Signatory</div></div>
</div>`;
}

function buildDetailedBillHtml(
  billType: string,
  patient: any,
  entries: BillingEntry[],
  investigations: Investigation[],
  bedAllotments: BedAllotment[],
  pharmBills: PharmBill[],
  fallbackBed: { rate: number; days: number; charge: number } | null,
  estEndDate: Date | null,
  totalBedCharge: number,
  servicesDiscount: number,
  servicesGross: number,
  servicesNet: number,
  invTotal: number,
  pharmTotal: number,
  pharmacyReturn: number,
  billDiscAmt: number,
  grandTotal: number,
  receiptSummary: ReceiptSummary | null,
  logo: string,
) {
  const bedRows = bedAllotments.map(a => {
    const days = a.endDate && a.allotmentDate
      ? computeBillingDays(new Date(a.allotmentDate), new Date(a.endDate))
      : (a.allotmentDate && estEndDate ? computeBillingDays(new Date(a.allotmentDate), estEndDate) : 1);
    return `<tr>
      <td>${fmtDate(a.allotmentDate)} ${a.allotmentTime || ""}</td>
      <td>${a.endDate ? fmtDate(a.endDate) + " " + (a.endTime || "") : "—"}</td>
      <td>${a.bedCategory}</td>
      <td class="center">${a.bedNo}</td>
      <td class="right">${fmt(a.charge)}</td>
      <td class="center">${days}</td>
      <td class="right bold">${fmt(days * a.charge)}</td>
    </tr>`;
  }).join("");

  const svcRows = entries.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${e.serviceName}</td>
      <td class="sub">${e.serviceGroup}</td>
      <td class="center">${e.quantity}</td>
      <td class="right">${fmt(e.unitCharge)}</td>
      <td class="right">${(e.unitCharge * e.quantity - e.totalCharge) > 0 ? `<span style="color:#ef4444">${fmt(e.unitCharge * e.quantity - e.totalCharge)}</span>` : "—"}</td>
      <td class="right bold">${fmt(e.totalCharge)}</td>
    </tr>`).join("");

  const invRows = investigations.flatMap(inv =>
    (inv.items || []).filter(it => it.description).map(it => `
    <tr>
      <td style="font-family:monospace;font-size:10px">${inv.reqNo}</td>
      <td>${fmtDate(inv.reqDate)}</td>
      <td>${it.description}</td>
      <td>${it.category || "—"}</td>
      <td class="right bold">${fmt(it.netAmount || 0)}</td>
    </tr>`)
  ).join("");

  const pharmRows = pharmBills.flatMap(bill =>
    bill.items.map(it => `
    <tr>
      <td style="font-family:monospace;font-size:10px">${bill.vendorBillNo || "—"}</td>
      <td>${fmtDate(bill.billDate)}</td>
      <td>${it.itemName}</td>
      <td>${it.package || "—"}</td>
      <td class="center">${it.qty}</td>
      <td class="right">${fmt(parseFloat(String(it.mrp)) || 0)}</td>
      <td class="center">${it.discount || 0}${it.discountType || "%"}</td>
      <td class="right bold">${fmt(it.netAmount)}</td>
    </tr>`)
  ).join("");

  const fallbackBedRow = !bedAllotments.length && fallbackBed ? `
    <tr>
      <td>${fmtDate(patient.admissionDate)} ${patient.admissionTime || ""}</td>
      <td>—</td>
      <td>${patient.bedCategory || "—"}</td>
      <td class="center">${patient.bedNo || "—"}</td>
      <td class="right">${fmt(fallbackBed.rate)}</td>
      <td class="center">${fallbackBed.days}</td>
      <td class="right bold">${fmt(fallbackBed.charge)}</td>
    </tr>` : "";

  const showBedSection = bedAllotments.length > 0 || (fallbackBed && fallbackBed.charge > 0);

  return `
<div class="header">
  <img src="${logo}" alt="Logo" style="height:60px;object-fit:contain"/>
  <div class="header-right">
    <div class="bill-type">${billType}</div>
    <div class="bill-sub">Arogya Maternity &amp; Nursing Home</div>
  </div>
</div>
${patientInfoBlock(patient)}
${showBedSection ? `
<h2>Bed Details</h2>
<table>
  <thead><tr><th>From Date</th><th>To Date</th><th>Bed Category</th><th class="center">Bed No</th><th class="right">Rate/Day</th><th class="center">Days</th><th class="right">Charge</th></tr></thead>
  <tbody>
    ${bedRows || fallbackBedRow}
    <tr class="total-row"><td colspan="6">Total Bed Charge</td><td class="right">${fmt(totalBedCharge)}</td></tr>
  </tbody>
</table>` : ""}

<h2>Services (Nursing Home Charges)</h2>
<table>
  <thead><tr><th>#</th><th>Service</th><th>Group</th><th class="center">Qty</th><th class="right">Unit Rate</th><th class="right">Discount</th><th class="right">Amount</th></tr></thead>
  <tbody>
    ${svcRows}
    <tr class="total-row">
      <td colspan="5">Nursing Home Charges</td>
      <td class="right" style="color:#ef4444">${servicesDiscount > 0 ? fmt(servicesDiscount) : "—"}</td>
      <td class="right">${fmt(servicesNet)}</td>
    </tr>
  </tbody>
</table>

${investigations.length > 0 ? `
<h2>Investigations</h2>
<table>
  <thead><tr><th>Req No</th><th>Date</th><th>Description</th><th>Category</th><th class="right">Net Amt</th></tr></thead>
  <tbody>
    ${invRows}
    <tr class="total-row"><td colspan="4">Investigations Total</td><td class="right">${fmt(invTotal)}</td></tr>
  </tbody>
</table>` : ""}

${pharmBills.length > 0 ? `
<h2>Pharmacy</h2>
<table>
  <thead><tr><th>Bill No</th><th>Date</th><th>Item</th><th>Package</th><th class="center">Qty</th><th class="right">MRP</th><th class="center">Discount</th><th class="right">Net Amt</th></tr></thead>
  <tbody>
    ${pharmRows}
    ${pharmacyReturn > 0 ? `
    <tr class="total-row"><td colspan="7">Pharmacy Sub Total</td><td class="right">${fmt(pharmTotal + pharmacyReturn)}</td></tr>
    <tr class="total-row"><td colspan="7" style="color:#ef4444">(-) Pharmacy Return</td><td class="right" style="color:#ef4444">${fmt(pharmacyReturn)}</td></tr>` : ""}
    <tr class="total-row"><td colspan="7">Pharmacy Total</td><td class="right">${fmt(pharmTotal)}</td></tr>
  </tbody>
</table>` : ""}

${totalsBlock(totalBedCharge, servicesGross, invTotal, pharmTotal, servicesDiscount, billDiscAmt, grandTotal, receiptSummary)}`;
}

function buildSummaryBillHtml(
  billType: string,
  patient: any,
  bedAllotments: BedAllotment[],
  fallbackBed: { rate: number; days: number; charge: number } | null,
  estEndDate: Date | null,
  totalBedCharge: number,
  serviceGroups: Record<string, { gross: number; discount: number; net: number }>,
  servicesDiscount: number,
  servicesGross: number,
  servicesNet: number,
  invTotal: number,
  pharmTotal: number,
  pharmacyReturn: number,
  billDiscAmt: number,
  grandTotal: number,
  receiptSummary: ReceiptSummary | null,
  logo: string,
  investigations: Investigation[],
  pharmBills: PharmBill[],
) {
  const bedSummaryRows = bedAllotments.length > 0
    ? bedAllotments.map(a => {
        const days = a.endDate && a.allotmentDate
          ? computeBillingDays(new Date(a.allotmentDate), new Date(a.endDate))
          : (a.allotmentDate && estEndDate ? computeBillingDays(new Date(a.allotmentDate), estEndDate) : 1);
        return `<tr>
          <td>${a.bedCategory}</td>
          <td>${a.bedNo}</td>
          <td>${fmtDate(a.allotmentDate)}</td>
          <td>${a.endDate ? fmtDate(a.endDate) : "—"}</td>
          <td class="right">${fmt(a.charge)}</td>
          <td class="center">${days}</td>
          <td class="right bold">${fmt(days * a.charge)}</td>
        </tr>`;
      }).join("")
    : (fallbackBed && fallbackBed.charge > 0 ? `<tr>
        <td>${patient.bedCategory || "—"}</td>
        <td>${patient.bedNo || "—"}</td>
        <td>${fmtDate(patient.admissionDate)}</td>
        <td>—</td>
        <td class="right">${fmt(fallbackBed.rate)}</td>
        <td class="center">${fallbackBed.days}</td>
        <td class="right bold">${fmt(fallbackBed.charge)}</td>
      </tr>` : "");

  const svcGroupRows = Object.entries(serviceGroups).map(([grp, data]) => `
    <tr>
      <td>${grp}</td>
      <td class="right">${fmt(data.gross)}</td>
      <td class="right" style="color:#ef4444">${data.discount > 0 ? fmt(data.discount) : "—"}</td>
      <td class="right bold">${fmt(data.net)}</td>
    </tr>`).join("");

  const showBedSection = bedAllotments.length > 0 || (fallbackBed && fallbackBed.charge > 0);

  return `
<div class="header">
  <img src="${logo}" alt="Logo" style="height:60px;object-fit:contain"/>
  <div class="header-right">
    <div class="bill-type">${billType}</div>
    <div class="bill-sub">Arogya Maternity &amp; Nursing Home</div>
  </div>
</div>
${patientInfoBlock(patient)}
${showBedSection ? `
<h2>Bed Details</h2>
<table>
  <thead><tr><th>Bed Category</th><th>Bed No</th><th>From</th><th>To</th><th class="right">Rate/Day</th><th class="center">Days</th><th class="right">Charge</th></tr></thead>
  <tbody>
    ${bedSummaryRows}
    <tr class="total-row"><td colspan="6">Total Bed Charge</td><td class="right">${fmt(totalBedCharge)}</td></tr>
  </tbody>
</table>` : ""}

<h2>Services (Nursing Home Charges)</h2>
<table>
  <thead><tr><th>Service Group</th><th class="right">Gross</th><th class="right">Discount</th><th class="right">Net</th></tr></thead>
  <tbody>
    ${svcGroupRows}
    <tr class="total-row">
      <td>Total</td>
      <td class="right"></td>
      <td class="right" style="color:#ef4444">${servicesDiscount > 0 ? fmt(servicesDiscount) : "—"}</td>
      <td class="right">${fmt(servicesNet)}</td>
    </tr>
  </tbody>
</table>

${invTotal > 0 ? `
<h2>Investigations</h2>
<table>
  <thead><tr><th>Req No</th><th>Date</th><th>Description</th><th>Category</th><th class="right">Net Amt</th></tr></thead>
  <tbody>
    ${investigations.flatMap(inv =>
      (inv.items || []).filter((it: any) => it.description).map((it: any) => `
      <tr>
        <td style="font-family:monospace;font-size:10px">${inv.reqNo}</td>
        <td>${fmtDate(inv.reqDate)}</td>
        <td>${it.description}</td>
        <td>${it.category || "—"}</td>
        <td class="right bold">${fmt(it.netAmount || 0)}</td>
      </tr>`)
    ).join("")}
    <tr class="total-row"><td colspan="4">Investigations Total</td><td class="right">${fmt(invTotal)}</td></tr>
  </tbody>
</table>` : ""}

${(pharmTotal > 0 || pharmacyReturn > 0) ? `
<h2>Pharmacy</h2>
<table>
  <thead><tr><th>Bill No</th><th>Date</th><th>Item</th><th>Package</th><th class="center">Qty</th><th class="right">MRP</th><th class="center">Discount</th><th class="right">Net Amt</th></tr></thead>
  <tbody>
    ${pharmBills.flatMap((bill: any) =>
      bill.items.map((it: any) => `
      <tr>
        <td style="font-family:monospace;font-size:10px">${bill.vendorBillNo || "—"}</td>
        <td>${fmtDate(bill.billDate)}</td>
        <td>${it.itemName}</td>
        <td>${it.package || "—"}</td>
        <td class="center">${it.qty}</td>
        <td class="right">${fmt(parseFloat(String(it.mrp)) || 0)}</td>
        <td class="center">${it.discount || 0}${it.discountType || "%"}</td>
        <td class="right bold">${fmt(it.netAmount)}</td>
      </tr>`)
    ).join("")}
    ${pharmacyReturn > 0 ? `
    <tr class="total-row"><td colspan="7">Pharmacy Sub Total</td><td class="right">${fmt(pharmTotal + pharmacyReturn)}</td></tr>
    <tr class="total-row"><td colspan="7" style="color:#ef4444">(-) Pharmacy Return</td><td class="right" style="color:#ef4444">${fmt(pharmacyReturn)}</td></tr>` : ""}
    <tr class="total-row"><td colspan="7">Pharmacy Total</td><td class="right">${fmt(pharmTotal)}</td></tr>
  </tbody>
</table>` : ""}

${totalsBlock(totalBedCharge, servicesGross, invTotal, pharmTotal, servicesDiscount, billDiscAmt, grandTotal, receiptSummary)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function IpdBilling() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();

  const [patient,        setPatient]        = useState<any>(null);
  const [entries,        setEntries]        = useState<BillingEntry[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [bedAllotments,  setBedAllotments]  = useState<BedAllotment[]>([]);
  const [receiptSummary, setReceiptSummary] = useState<ReceiptSummary | null>(null);
  const [pharmBills,     setPharmBills]     = useState<PharmBill[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [billDiscInput,    setBillDiscInput]    = useState("");
  const [billDiscType,     setBillDiscType]     = useState<"flat" | "percent">("flat");
  const [billDiscSaved,    setBillDiscSaved]    = useState<number | null>(null);
  const [savingBillDisc,   setSavingBillDisc]   = useState(false);
  const [estDate,    setEstDate]    = useState(() => { const n = new Date(); return new Date(n.getTime() + 330 * 60000).toISOString().slice(0, 10); });
  const [estTime,    setEstTime]    = useState(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
  });
  const [estManual,  setEstManual]  = useState(false);
  const [estSaving,  setEstSaving]  = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      ipdService.getPatient(id),
      ipdService.getBillingEntries(id),
      ipdService.getInvestigations(id),
      ipdService.getBedAllotments(id),
      ipdService.getReceiptSummary(id),
      ipdService.getPharmacyBills(id),
    ])
      .then(([pRes, bRes, iRes, aRes, rRes, phRes]) => {
        const p = pRes.data.data;
        const allotments: BedAllotment[] = aRes.data.data.allotments || [];
        setPatient(p);
        setEntries(bRes.data.data.entries || []);
        setInvestigations(iRes.data.data.investigations || []);
        setBedAllotments(allotments);
        setReceiptSummary(rRes.data.data || null);
        setPharmBills(phRes.data.data.bills || []);

        if (p.billDiscount != null) {
          setBillDiscSaved(p.billDiscount);
          setBillDiscInput(String(p.billDiscount));
          setBillDiscType(p.billDiscountType === "percent" ? "percent" : "flat");
        }

        if (p.estimateEndDate) {
          const d = new Date(p.estimateEndDate);
          const ist = new Date(d.getTime() + 330 * 60000); // UTC → IST
          setEstDate(ist.toISOString().slice(0, 10));
          setEstTime(p.estimateEndTime || "00:00");
          setEstManual(true);
        }
      })
      .catch(() => toast.error("Failed to load billing data"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (estManual) return;
    const t = setInterval(() => {
      const n = new Date();
      setEstDate(new Date(n.getTime() + 330 * 60000).toISOString().slice(0, 10));
      setEstTime(`${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`);
    }, 60000);
    return () => clearInterval(t);
  }, [estManual]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  if (!patient) return <div className="flex items-center justify-center h-64 text-red-500">Patient not found</div>;

  // ── Derived totals ────────────────────────────────────────────────────────────

  const serviceGroups = entries.reduce<
    Record<string, { entries: BillingEntry[]; gross: number; discount: number; net: number }>
  >((acc, e) => {
    const key = e.serviceGroup || "Other";
    if (!acc[key]) acc[key] = { entries: [], gross: 0, discount: 0, net: 0 };
    acc[key].entries.push(e);
    const gross = e.unitCharge * e.quantity;
    acc[key].gross    += gross;
    acc[key].discount += gross - e.totalCharge;
    acc[key].net      += e.totalCharge;
    return acc;
  }, {});

  const servicesGross    = entries.reduce((s, e) => s + e.unitCharge * e.quantity, 0);
  const servicesDiscount = entries.reduce((s, e) => s + (e.unitCharge * e.quantity - e.totalCharge), 0);
  const servicesNet      = entries.reduce((s, e) => s + e.totalCharge, 0);
  const invTotal         = investigations.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const pharmGross       = pharmBills.reduce((s, b) => s + (b.netAmount || 0), 0);
  const pharmacyReturn   = patient.pharmacyReturn || 0;
  const pharmTotal       = Math.max(0, pharmGross - pharmacyReturn);

  // Bed charge from allotments; fall back to patient bed × manually chosen estimate date
  const fallbackRate = patient.bedCategory ? (BED_CHARGES[patient.bedCategory] ?? 0) : 0;
  const fallbackEndDate = patient.dischargeDate
    ? new Date(patient.dischargeDate)
    : (estDate ? new Date(`${estDate}T${estTime || "00:00"}`) : null);
  const fallbackDays = patient.admissionDate && fallbackEndDate
    ? computeBillingDays(new Date(patient.admissionDate), fallbackEndDate)
    : 1;
  const fallbackBed = bedAllotments.length === 0 && patient.bedCategory
    ? { rate: fallbackRate, days: fallbackDays, charge: fallbackRate * fallbackDays }
    : null;

  const openEndDate: Date = fallbackEndDate ?? new Date();
  const totalBedCharge = bedAllotments.length > 0
    ? bedAllotments.reduce((s, a) => {
        if (!a.allotmentDate) return s;
        const days = a.endDate
          ? computeBillingDays(new Date(a.allotmentDate), new Date(a.endDate))
          : computeBillingDays(new Date(a.allotmentDate), openEndDate);
        return s + days * (a.charge || 0);
      }, 0)
    : (fallbackBed?.charge ?? 0);

  const totalCharge    = totalBedCharge + servicesGross + invTotal + pharmTotal;
  const preDiscTotal   = totalCharge - servicesDiscount;
  const billDiscAmt    = billDiscSaved != null
    ? (billDiscType === "percent" ? preDiscTotal * billDiscSaved / 100 : billDiscSaved)
    : 0;
  const grandTotal     = preDiscTotal - billDiscAmt;
  const totalPaid      = receiptSummary?.totalReceived    ?? 0;
  const totalTds       = receiptSummary?.totalTds         ?? 0;
  const totalDis       = receiptSummary?.totalDisallowed  ?? 0;
  const netDue         = Math.max(0, grandTotal - totalPaid - totalTds - totalDis);

  const isEstimate   = patient.status !== "Discharged";
  const billLabel    = isEstimate ? "ESTIMATED BILL" : "FINAL BILL";

  const handleSaveBillDisc = async () => {
    const val = Number(billDiscInput);
    if (isNaN(val) || val < 0) return toast.error("Enter a valid discount");
    if (billDiscType === "percent" && val > 100) return toast.error("Percentage cannot exceed 100");
    if (!(await confirm({ title: "Save bill discount?", description: "This discount will be applied to the patient's total bill." }))) return;
    setSavingBillDisc(true);
    try {
      await ipdService.updatePatient(id!, { billDiscount: val, billDiscountType: billDiscType });
      setBillDiscSaved(val);
      toast.success("Bill discount saved");
    } catch { toast.error("Failed to save"); }
    finally { setSavingBillDisc(false); }
  };

  const handleClearBillDisc = async () => {
    setSavingBillDisc(true);
    try {
      await ipdService.updatePatient(id!, { billDiscount: null });
      setBillDiscSaved(null);
      setBillDiscInput("");
      setBillDiscType("flat");
      toast.success("Discount removed");
    } catch { toast.error("Failed to clear"); }
    finally { setSavingBillDisc(false); }
  };

  const handleSetEstimate = async () => {
    if (!estDate) return toast.error("Select a date");
    if (!(await confirm({ title: "Save reference date?", description: "This reference date will be used across all billing pages for this patient." }))) return;
    setEstSaving(true);
    try {
      const estDt = new Date(`${estDate}T${estTime || "00:00"}`);
      await ipdService.updatePatient(id!, { estimateEndDate: estDt, estimateEndTime: estTime });
      setEstManual(true);
      setPatient((p: any) => ({ ...p, estimateEndDate: estDt.toISOString(), estimateEndTime: estTime }));
      toast.success("Reference date saved — all pages will use this");
    } catch { toast.error("Failed to save reference date"); }
    finally { setEstSaving(false); }
  };

  const handleClearEstimate = async () => {
    setEstSaving(true);
    try {
      await ipdService.updatePatient(id!, { estimateEndDate: null, estimateEndTime: null });
      setEstManual(false);
      setPatient((p: any) => ({ ...p, estimateEndDate: null, estimateEndTime: null }));
      const n = new Date();
      setEstDate(new Date(n.getTime() + 330 * 60000).toISOString().slice(0, 10));
      setEstTime(`${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`);
      toast.success("Reverted to live auto-increment");
    } catch { toast.error("Failed to clear"); }
    finally { setEstSaving(false); }
  };

  const handlePrintDetailed = () =>
    openPrintWindow(
      `${billLabel} — ${patient.admissionId}`,
      buildDetailedBillHtml(
        billLabel, patient, entries, investigations, bedAllotments, pharmBills,
        fallbackBed, fallbackEndDate,
        totalBedCharge, servicesDiscount, servicesGross, servicesNet,
        invTotal, pharmTotal, pharmacyReturn, billDiscAmt, grandTotal, receiptSummary, logoUrl,
      ),
    );

  const handlePrintSummary = () =>
    openPrintWindow(
      `${billLabel} (Summary) — ${patient.admissionId}`,
      buildSummaryBillHtml(
        billLabel, patient, bedAllotments, fallbackBed, fallbackEndDate,
        totalBedCharge,
        Object.fromEntries(Object.entries(serviceGroups).map(([k, v]) => [k, { gross: v.gross, discount: v.discount, net: v.net }])),
        servicesDiscount, servicesGross, servicesNet, invTotal, pharmTotal, pharmacyReturn, billDiscAmt, grandTotal, receiptSummary, logoUrl,
        investigations, pharmBills,
      ),
    );

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/ipd/edit/${id}`)} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">IPD — Billing</h1>
            <p className="text-gray-500 text-sm font-mono">{patient.admissionId}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
            onClick={() => navigate(`/ipd/receipt/${id}`)}>
            <Receipt className="h-4 w-4" /> Receipts
          </Button>
          <Button variant="outline" className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            onClick={handlePrintSummary}>
            <Printer className="h-4 w-4" /> Print Summary
          </Button>
          <Button onClick={handlePrintDetailed} className="bg-red-600 hover:bg-red-700 gap-2">
            <Printer className="h-4 w-4" /> {isEstimate ? "Print Estimate" : "Print Final Bill"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="bill">
        <TabsList>
          <TabsTrigger value="bill">Patient Bill</TabsTrigger>
          <TabsTrigger value="detail">Line Items</TabsTrigger>
        </TabsList>

        {/* ── Patient Bill (matches PDF layout) ─────────────────────────────────── */}
        <TabsContent value="bill" className="space-y-4 mt-4">

          {/* Patient info row */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-xs text-gray-500 block">Patient Name</span>
                  <span className="font-semibold">{patient.title} {patient.name}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Adm No / Bill No</span>
                  <span className="font-mono font-semibold">{patient.admissionId}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Adm Date</span>
                  <span>{fmtDate(patient.admissionDate)} {patient.admissionTime || ""}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Status</span>
                  <span className={`font-semibold ${patient.status === "Admitted" ? "text-green-600" : "text-orange-600"}`}>
                    {patient.status}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Sex / Age</span>
                  <span>{patient.gender} / {patient.ageYears}Y</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Attended Dr.</span>
                  <span>{patient.doctors?.map((d: any) => d.doctorName).join(", ") || "—"}</span>
                </div>
                {patient.dischargeDate && (
                  <div>
                    <span className="text-xs text-gray-500 block">Discharge</span>
                    <span>{fmtDate(patient.dischargeDate)} {patient.dischargeTime || ""}</span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-gray-500 block">Patient Category</span>
                  <span>{patient.patientCategory || "GENERAL"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bed Details */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Bed Details</CardTitle>
                {isEstimate && (bedAllotments.length === 0 || bedAllotments.some(a => !a.endDate)) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Calculate until:</span>
                    {estManual && (
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">manual</span>
                    )}
                    <Input
                      type="date"
                      value={estDate}
                      onChange={e => setEstDate(e.target.value)}
                      className="h-7 text-xs w-36"
                    />
                    <Input
                      type="time"
                      value={estTime}
                      onChange={e => setEstTime(e.target.value)}
                      className="h-7 text-xs w-28"
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 px-2"
                      onClick={handleSetEstimate}
                      disabled={estSaving}
                    >
                      {estSaving ? "…" : "Set"}
                    </Button>
                    {estManual && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-gray-400 hover:text-gray-600 px-2"
                        onClick={handleClearEstimate}
                        disabled={estSaving}
                      >
                        Clear
                      </Button>
                    )}
                    <span className="text-xs font-semibold text-indigo-700">
                      = {fallbackDays} day{fallbackDays !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {bedAllotments.length === 0 ? (
                <div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <th className="text-left px-4 py-2 font-medium">Adm Date</th>
                        <th className="text-left px-4 py-2 font-medium">Time</th>
                        <th className="text-left px-4 py-2 font-medium">Bed Category</th>
                        <th className="text-center px-4 py-2 font-medium">Bed No</th>
                        <th className="text-right px-4 py-2 font-medium">Until Date</th>
                        <th className="text-right px-4 py-2 font-medium">Until Time</th>
                        <th className="text-right px-4 py-2 font-medium">Rate/Day</th>
                        <th className="text-center px-4 py-2 font-medium">Days</th>
                        <th className="text-right px-4 py-2 font-medium">Charge</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="px-4 py-2">{fmtDate(patient.admissionDate)}</td>
                        <td className="px-4 py-2 text-gray-500">{patient.admissionTime || "—"}</td>
                        <td className="px-4 py-2 font-medium">{patient.bedCategory || "—"}</td>
                        <td className="px-4 py-2 text-center">{patient.bedNo || "—"}</td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {patient.dischargeDate ? fmtDate(patient.dischargeDate) : fmtDate(estDate)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {patient.dischargeTime || estTime || "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {fmt(fallbackRate)}
                        </td>
                        <td className="px-4 py-2 text-center font-semibold">{fallbackDays}</td>
                        <td className="px-4 py-2 text-right font-semibold text-indigo-700">{fmt(totalBedCharge)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="text-left px-4 py-2 font-medium">From</th>
                      <th className="text-left px-4 py-2 font-medium">Bed Category</th>
                      <th className="text-center px-4 py-2 font-medium">Bed No</th>
                      <th className="text-left px-4 py-2 font-medium">To</th>
                      <th className="text-right px-4 py-2 font-medium">Rate/Day</th>
                      <th className="text-center px-4 py-2 font-medium">Days</th>
                      <th className="text-right px-4 py-2 font-medium">Charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bedAllotments.map(a => {
                      const days = !a.allotmentDate ? 1
                        : a.endDate
                          ? computeBillingDays(new Date(a.allotmentDate), new Date(a.endDate))
                          : computeBillingDays(new Date(a.allotmentDate), openEndDate);
                      return (
                        <tr key={a._id} className="border-t">
                          <td className="px-4 py-2">
                            {fmtDate(a.allotmentDate)}
                            {a.allotmentTime ? <span className="text-xs text-gray-400 ml-1">{a.allotmentTime}</span> : ""}
                          </td>
                          <td className="px-4 py-2 font-medium">{a.bedCategory}</td>
                          <td className="px-4 py-2 text-center">{a.bedNo}</td>
                          <td className="px-4 py-2 text-gray-500">
                            {a.endDate
                              ? <>{fmtDate(a.endDate)}{a.endTime ? <span className="text-xs ml-1">{a.endTime}</span> : ""}</>
                              : <span className="text-xs text-orange-500">{fmtDate(openEndDate.toISOString())} {estTime} <span className="text-gray-400">{estManual ? "(est)" : "(live)"}</span></span>}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600">{fmt(a.charge)}</td>
                          <td className="px-4 py-2 text-center font-semibold">{days}</td>
                          <td className="px-4 py-2 text-right font-semibold text-indigo-700">{fmt(days * a.charge)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div className="flex items-center justify-between px-4 py-2.5 border-t bg-gray-50">
                <span className="text-sm font-medium text-gray-700">Total Bed Charge</span>
                <span className="font-bold text-indigo-700">{fmt(totalBedCharge)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Service Details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Service Details</CardTitle>
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
                        <td className="text-right px-4 py-2 text-red-500">{data.discount > 0 ? fmt(data.discount) : "—"}</td>
                        <td className="text-right px-4 py-2 font-medium">{fmt(data.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Investigations */}
          {investigations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Investigations</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {investigations.map(inv => (
                  <div key={inv._id} className="border-t first:border-t-0">
                    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 text-xs text-gray-500">
                      <span className="font-mono font-semibold text-gray-700">{inv.reqNo}</span>
                      <span>{fmtDate(inv.reqDate)}</span>
                      {inv.vendor && <span>{inv.vendor}</span>}
                      {inv.vendorBillNo && <span>Bill: {inv.vendorBillNo}</span>}
                      <span className="ml-auto font-semibold text-purple-700">{fmt(inv.totalAmount || 0)}</span>
                    </div>
                    {inv.items?.length > 0 && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 uppercase border-b">
                            <th className="px-4 py-1 text-left font-medium">#</th>
                            <th className="px-4 py-1 text-left font-medium">Description</th>
                            <th className="px-4 py-1 text-left font-medium">Category</th>
                            <th className="px-4 py-1 text-right font-medium">Lab Amt</th>
                            <th className="px-4 py-1 text-right font-medium">Net Amt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inv.items.map((it, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-4 py-1.5 text-gray-400">{it.slNo || i + 1}</td>
                              <td className="px-4 py-1.5 font-medium">{it.description}</td>
                              <td className="px-4 py-1.5 text-gray-500">{it.category || "—"}</td>
                              <td className="px-4 py-1.5 text-right text-gray-500">{it.amount > 0 ? fmt(it.amount) : "—"}</td>
                              <td className="px-4 py-1.5 text-right font-semibold text-purple-700">{fmt(it.netAmount || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
                <div className="flex justify-between items-center px-4 py-2 border-t bg-gray-50">
                  <span className="text-sm font-medium text-gray-700">Total Investigation Charge</span>
                  <span className="font-bold text-purple-700">{fmt(invTotal)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pharmacy */}
          {pharmBills.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pharmacy</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {pharmBills.map(bill => (
                  <div key={bill._id} className="border-t first:border-t-0">
                    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 text-xs text-gray-500">
                      <span className="font-mono font-semibold text-gray-700">{bill.vendorBillNo || "—"}</span>
                      <span>{fmtDate(bill.billDate)}</span>
                      {bill.vendor && <span>{bill.vendor}</span>}
                      {bill.referredBy && <span>Ref: {bill.referredBy}</span>}
                      <span className="ml-auto font-semibold text-green-700">{fmt(bill.netAmount)}</span>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 uppercase border-b">
                          <th className="px-4 py-1 text-left font-medium">Item</th>
                          <th className="px-4 py-1 text-left font-medium">Package</th>
                          <th className="px-4 py-1 text-center font-medium">Qty</th>
                          <th className="px-4 py-1 text-right font-medium">MRP</th>
                          <th className="px-4 py-1 text-center font-medium">Discount</th>
                          <th className="px-4 py-1 text-right font-medium">Net Amt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bill.items.map((it, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-4 py-1.5 font-medium">{it.itemName}</td>
                            <td className="px-4 py-1.5 text-gray-500">{it.package || "—"}</td>
                            <td className="px-4 py-1.5 text-center">{it.qty}</td>
                            <td className="px-4 py-1.5 text-right">{fmt(parseFloat(String(it.mrp)) || 0)}</td>
                            <td className="px-4 py-1.5 text-center">{it.discount || 0}{it.discountType || "%"}</td>
                            <td className="px-4 py-1.5 text-right font-semibold text-green-700">{fmt(it.netAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {pharmacyReturn > 0 && (
                  <div className="flex justify-between items-center px-4 py-1 border-t bg-gray-50 text-sm">
                    <span className="text-red-500">(-) Pharmacy Return</span>
                    <span className="font-medium text-red-500">{fmt(pharmacyReturn)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center px-4 py-2 border-t bg-gray-50">
                  <span className="text-sm font-medium text-gray-700">Total Pharmacy Charge</span>
                  <span className="font-bold text-green-700">{fmt(pharmTotal)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bill Totals — matching PDF layout */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bill Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end">
                <div className="min-w-72 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Bed Charge</span>
                    <span className="font-medium">{fmt(totalBedCharge)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nursing Home Charge</span>
                    <span className="font-medium">{fmt(servicesGross)}</span>
                  </div>
                  {invTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Investigations</span>
                      <span className="font-medium">{fmt(invTotal)}</span>
                    </div>
                  )}
                  {(pharmTotal > 0 || pharmacyReturn > 0) && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pharmacy</span>
                      <span className="font-medium">{fmt(pharmGross)}</span>
                    </div>
                  )}
                  {pharmacyReturn > 0 && (
                    <div className="flex justify-between">
                      <span className="text-red-500">(-) Pharmacy Return</span>
                      <span className="font-medium text-red-500">{fmt(pharmacyReturn)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="text-gray-600">Total Charge</span>
                    <span className="font-semibold">{fmt(totalCharge)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service Charge</span>
                    <span className="text-gray-400">—</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Grand Total</span>
                    <span className="font-semibold">{fmt(totalCharge)}</span>
                  </div>
                  {servicesDiscount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>(-)Less Discount</span>
                      <span className="font-semibold">{fmt(servicesDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="text-gray-700 font-medium">Net Total</span>
                    <span className="font-bold">{fmt(preDiscTotal)}</span>
                  </div>

                  {/* Bill-level discount */}
                  <div className="border rounded-md bg-gray-50 px-3 py-2 space-y-2 mt-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-600">Bill Discount</span>
                      {billDiscSaved != null && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          {billDiscType === "percent" ? `${billDiscSaved}%` : fmt(billDiscSaved)} saved
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex rounded-md border overflow-hidden shrink-0">
                        <button type="button"
                          onClick={() => setBillDiscType("flat")}
                          className={`px-2 py-1 text-xs font-medium transition-colors ${billDiscType === "flat" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                          ₹
                        </button>
                        <button type="button"
                          onClick={() => setBillDiscType("percent")}
                          className={`px-2 py-1 text-xs font-medium transition-colors ${billDiscType === "percent" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                          %
                        </button>
                      </div>
                      <Input
                        type="number" min={0} max={billDiscType === "percent" ? 100 : undefined}
                        value={billDiscInput}
                        onChange={e => setBillDiscInput(e.target.value)}
                        placeholder="0"
                        className="h-7 text-xs w-24 text-right"
                      />
                      <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                        onClick={handleSaveBillDisc} disabled={savingBillDisc}>
                        {savingBillDisc ? "…" : "Save"}
                      </Button>
                      {billDiscSaved != null && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500"
                          onClick={handleClearBillDisc} disabled={savingBillDisc}>
                          Clear
                        </Button>
                      )}
                    </div>
                    {billDiscSaved != null && (
                      <div className="flex justify-between text-xs text-red-600 font-medium pt-0.5">
                        <span>(-)Discount Applied</span>
                        <span>{fmt(billDiscAmt)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Actual Bill Amount</span>
                    <span className="font-medium">{fmt(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Paid Amount</span>
                    <span className="font-medium text-green-700">{fmt(totalPaid)}</span>
                  </div>
                  {totalTds > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total TDS Amount</span>
                      <span className="font-medium">{fmt(totalTds)}</span>
                    </div>
                  )}
                  {totalDis > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Disallowed Amount</span>
                      <span className="font-medium">{fmt(totalDis)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="text-gray-600">Net Due Amount</span>
                    <span className={`font-semibold ${netDue > 0 ? "text-red-600" : "text-green-600"}`}>{fmt(netDue)}</span>
                  </div>
                  <div className="flex justify-between border-t-2 border-gray-900 pt-2 mt-1">
                    <span className="font-bold">Payable By Patient</span>
                    <span className={`text-xl font-bold ${netDue > 0 ? "text-red-700" : "text-green-700"}`}>{fmt(netDue)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isEstimate && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-3 pb-3 text-center text-sm text-amber-800">
                This is an estimated bill.
                <Button variant="link" className="text-amber-700 underline px-1 h-auto"
                  onClick={() => navigate(`/ipd/discharge/${id}`)}>
                  Discharge patient
                </Button>
                to generate the final bill.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Line Items Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="detail" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">All Service Entries</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {entries.length === 0 ? (
                <p className="px-6 py-4 text-sm text-gray-400">No service entries yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="text-left px-3 py-2 font-medium">Date</th>
                      <th className="text-left px-3 py-2 font-medium">Group</th>
                      <th className="text-left px-3 py-2 font-medium">Service</th>
                      <th className="text-right px-3 py-2 font-medium">Rate</th>
                      <th className="text-center px-3 py-2 font-medium">Qty</th>
                      <th className="text-right px-3 py-2 font-medium">Amount</th>
                      <th className="text-right px-3 py-2 font-medium">S.Charge</th>
                      <th className="text-left px-3 py-2 font-medium">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(e => (
                      <tr key={e._id} className="border-t">
                        <td className="px-3 py-1.5 text-xs text-gray-500">{fmtDate(e.date)}</td>
                        <td className="px-3 py-1.5 text-gray-600">{e.serviceGroup}</td>
                        <td className="px-3 py-1.5">{e.serviceName}</td>
                        <td className="px-3 py-1.5 text-right">{fmt(e.unitCharge)}</td>
                        <td className="px-3 py-1.5 text-center">{e.quantity}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{fmt(e.totalCharge)}</td>
                        <td className="px-3 py-1.5 text-right text-red-500">{(e.unitCharge * e.quantity - e.totalCharge) > 0 ? fmt(e.unitCharge * e.quantity - e.totalCharge) : "—"}</td>
                        <td className="px-3 py-1.5 text-gray-400 text-xs">{e.doctorName || ""}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-gray-50 font-semibold">
                      <td colSpan={4} className="px-3 py-2">Services Total</td>
                      <td className="px-3 py-2 text-center">{entries.reduce((s, e) => s + e.quantity, 0)}</td>
                      <td className="px-3 py-2 text-right">{fmt(servicesNet)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{servicesDiscount > 0 ? fmt(servicesDiscount) : "—"}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {investigations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Investigation Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="text-left px-3 py-2 font-medium">Req No</th>
                      <th className="text-left px-3 py-2 font-medium">Date</th>
                      <th className="text-left px-3 py-2 font-medium">Description</th>
                      <th className="text-left px-3 py-2 font-medium">Category</th>
                      <th className="text-right px-3 py-2 font-medium">Lab Amt</th>
                      <th className="text-right px-3 py-2 font-medium">Net Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investigations.flatMap(inv =>
                      (inv.items || []).map((it, i) => (
                        <tr key={`${inv._id}-${i}`} className="border-t">
                          <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{inv.reqNo}</td>
                          <td className="px-3 py-1.5 text-xs text-gray-500">{fmtDate(inv.reqDate)}</td>
                          <td className="px-3 py-1.5">{it.description}</td>
                          <td className="px-3 py-1.5 text-gray-500">{it.category || "—"}</td>
                          <td className="px-3 py-1.5 text-right text-gray-500">{it.amount > 0 ? fmt(it.amount) : "—"}</td>
                          <td className="px-3 py-1.5 text-right font-medium text-purple-700">{fmt(it.netAmount || 0)}</td>
                        </tr>
                      ))
                    )}
                    <tr className="border-t-2 bg-gray-50 font-semibold">
                      <td colSpan={5} className="px-3 py-2">Investigations Total</td>
                      <td className="px-3 py-2 text-right text-purple-700">{fmt(invTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {pharmBills.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pharmacy Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="text-left px-3 py-2 font-medium">Bill No</th>
                      <th className="text-left px-3 py-2 font-medium">Date</th>
                      <th className="text-left px-3 py-2 font-medium">Item</th>
                      <th className="text-left px-3 py-2 font-medium">Package</th>
                      <th className="text-center px-3 py-2 font-medium">Qty</th>
                      <th className="text-right px-3 py-2 font-medium">MRP</th>
                      <th className="text-center px-3 py-2 font-medium">Discount</th>
                      <th className="text-right px-3 py-2 font-medium">Net Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pharmBills.flatMap(bill =>
                      bill.items.map((it, i) => (
                        <tr key={`${bill._id}-${i}`} className="border-t">
                          <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{bill.vendorBillNo || "—"}</td>
                          <td className="px-3 py-1.5 text-xs text-gray-500">{fmtDate(bill.billDate)}</td>
                          <td className="px-3 py-1.5 font-medium">{it.itemName}</td>
                          <td className="px-3 py-1.5 text-gray-500">{it.package || "—"}</td>
                          <td className="px-3 py-1.5 text-center">{it.qty}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(parseFloat(String(it.mrp)) || 0)}</td>
                          <td className="px-3 py-1.5 text-center">{it.discount || 0}%</td>
                          <td className="px-3 py-1.5 text-right font-medium text-green-700">{fmt(it.netAmount)}</td>
                        </tr>
                      ))
                    )}
                    {pharmacyReturn > 0 && (
                      <>
                        <tr className="border-t bg-gray-50">
                          <td colSpan={7} className="px-3 py-2">Pharmacy Sub Total</td>
                          <td className="px-3 py-2 text-right">{fmt(pharmGross)}</td>
                        </tr>
                        <tr className="border-t bg-gray-50">
                          <td colSpan={7} className="px-3 py-2 text-red-500">(-) Pharmacy Return</td>
                          <td className="px-3 py-2 text-right text-red-500">{fmt(pharmacyReturn)}</td>
                        </tr>
                      </>
                    )}
                    <tr className="border-t-2 bg-gray-50 font-semibold">
                      <td colSpan={7} className="px-3 py-2">Pharmacy Total</td>
                      <td className="px-3 py-2 text-right text-green-700">{fmt(pharmTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog />
    </div>
  );
}
