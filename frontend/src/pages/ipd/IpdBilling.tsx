import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Printer, Receipt, Stethoscope, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import ipdService, { BED_CHARGES, computeBillingDays, combineISTDateTime, isBedChargeExempt, todayIST, nowISTTime, toISTDateStr, buildDiscountSections, type IpdDiscountSection } from "@/services/ipdService";
import { openIpdPrintWindow, printHeaderHtml, doctorServiceBoxHtml, wrapPrintDoc, chunkTableSections } from "@/lib/ipdPrint";
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
  gst?: number;
  gstType?: "percent" | "flat";
}

interface InvLineItem {
  slNo: number;
  code: string;
  description: string;
  amount: number;
  netAmount: number;
  category: string;
  remark: string;
  gst?: number;
  gstType?: "percent" | "flat";
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
  gst?: number;
  gstType?: "percent" | "flat";
}

interface PharmItem {
  itemName: string;
  package: string;
  qty: string | number;
  mrp: string | number;
  discount: string | number;
  discountType?: "%" | "₹";
  netAmount: number;
  gst?: number;
  gstType?: "percent" | "flat";
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

// Escape user free-text before dropping it into a print HTML string.
function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/\n/g, "<br>");
}

function gstAmt(base: number, gst?: number, gstType?: string): number {
  const g = Number(gst) || 0;
  if (g <= 0) return 0;
  return gstType === "flat" ? g : (base * g) / 100;
}

function gstLabel(gst?: number, gstType?: string): string {
  const g = Number(gst) || 0;
  if (g <= 0) return "";
  return gstType === "flat" ? fmt(g) : `${g}%`;
}

// One plain totals row per billing section that has a discount (Services /
// Investigation / Pharmacy, via buildDiscountSections in ipdService) — styled
// like the other rows above Net Total. No header, no total, no footnote.
function discountSummaryHtml(discountSections: IpdDiscountSection[]): string {
  return discountSections.map(sec =>
    `<div class="totals-row" style="color:#ef4444"><span>(-)${sec.section} Discount</span><span>${fmt(sec.total)}</span></div>`,
  ).join("");
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

// ─── Full billing print header ──────────────────────────────────────────────
// Returns { header, intro }:
//  - `header` = just the hospital identity box, rendered inside .print-header
//    which goes in the doc-grid <thead> and repeats on EVERY printed page. It's
//    short, fixed-height and flex-only (see BILL_PRINT_CSS @media print) so
//    Chrome reliably repeats it — the tall auto-height title+grid did not.
//  - `intro` = the bill title + two-column patient grid, rendered as the first
//    body section, so it only appears on page 1.
function billHeaderHtml(logo: string, billTitle: string, patient: any) {
  const doctors = patient.doctors?.length
    ? patient.doctors.map((d: any) => d.doctorName).join(", ")
    : "—";
  const ageStr = [
    patient.ageYears  ? patient.ageYears  + "Y" : "",
    patient.ageMonths ? patient.ageMonths + "M" : "",
    patient.ageDays   ? patient.ageDays   + "D" : "",
  ].filter(Boolean).join(" ") || "—";
  const invoiceDate = new Date().toLocaleDateString("en-IN",
    { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const corporate = patient.tpa || patient.insuranceCo || patient.patientCategory || "—";
  const bedInfo = patient.bedNo
    ? `${patient.bedNo}${patient.bedCategory ? ` (${patient.bedCategory})` : ""}`
    : "—";
  const row = (k: string, v: string, wrap = false) =>
    `<div class="row"><span class="k">${k}</span><span class="v${wrap ? " wrap" : ""}">${v}</span></div>`;
  const header = `
<div class="print-header">
  <div class="bill-hosp">
    <div class="logo-cell"><img src="${logo}" alt="Logo"/></div>
    <div class="hosp-cell">
      <div class="h-name">AROGYA MATERNITY &amp; NURSING HOME</div>
      <div class="h-line">(A Unit of R.P. Medical Foundation Pvt. Ltd.)</div>
      <div class="h-line">(Licence Under W.B. Clinical Establishment Act)</div>
      <div class="h-reg">Regd. No: 34257492</div>
      <div class="h-line">71, Tollygunge Circular Road, Kolkata-700053 (New Alipore, Sital Sadan Compound)</div>
      <div class="h-line">Phone: (033) 2400-0681 / 0684 &nbsp;|&nbsp; Fax: (033) 2400-1180</div>
    </div>
  </div>
</div>`;

  const intro = `
<div class="bill-title">${billTitle} Details</div>
<div class="bill-pat">
  <div class="col">
    ${row("Patient Id", patient.ipdRegistrationNo || patient.admissionId)}
    ${row("Admission No", patient.admissionId)}
    ${row("Admitting Doctor", doctors)}
    ${row("Patient Name", `${patient.title || ""} ${patient.name || ""}`.trim() || "—")}
    ${row("Sex / Age", `${patient.gender || "—"} / ${ageStr}`)}
    ${row("Address", patient.address || "—", true)}
    ${row("Corporate", corporate)}
  </div>
  <div class="col">
    ${row("Invoice No", patient.admissionId)}
    ${row("Invoice Date", invoiceDate)}
    ${row("Bed No", bedInfo)}
    ${row("Admission Dt", `${fmtDate(patient.admissionDate)} ${patient.admissionTime || ""}`.trim())}
    ${row("Discharge Dt", patient.dischargeDate
      ? `${fmtDate(patient.dischargeDate)} ${patient.dischargeTime || ""}`.trim()
      : "—")}
  </div>
</div>`;

  return { header, intro };
}

// Extra CSS appended after PRINT_BASE_CSS for the detailed / summary bills.
const BILL_PRINT_CSS = `
  /* Full billing header (hospital box + title + patient grid) overrides the
     compact shared .print-header. It renders in normal flow — see the @media
     print block below for why it is NOT position:fixed here. */
  .print-header { display: block; border-bottom: none; padding-bottom: 0; }
  .bill-hosp { display: flex; align-items: stretch; border: 1.5px solid #111; }
  .bill-hosp .logo-cell { display: flex; align-items: center; justify-content: center;
    padding: 10px 18px; border-right: 1.5px solid #111; }
  .bill-hosp .logo-cell img { width: 108px; height: 108px; object-fit: contain; }
  .bill-hosp .hosp-cell { flex: 1; text-align: center; padding: 10px 12px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .bill-hosp .h-name { font-size: 16px; font-weight: bold; letter-spacing: .02em; color: #111; }
  .bill-hosp .h-line { font-size: 9px; color: #333; margin-top: 1px; }
  .bill-hosp .h-reg  { font-size: 9px; font-weight: bold; margin-top: 2px; color: #111; }
  .bill-title { text-align: center; font-size: 13px; font-weight: bold; letter-spacing: .1em;
    text-transform: uppercase; text-decoration: underline; margin: 4px 0 12px; color: #111; }
  .bill-pat { display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px;
    border: 1px solid #cbd1d8; padding: 9px 12px; }
  .bill-pat .row { display: flex; font-size: 10px; padding: 1.5px 0; line-height: 1.35; }
  .bill-pat .k { width: 108px; flex-shrink: 0; color: #555; }
  .bill-pat .k::after { content: ":"; float: right; padding-right: 6px; }
  .bill-pat .v { font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bill-pat .v.wrap { white-space: normal; }

  /* Totals rendered as a framed summary box, right-aligned — not a bare
     floating column with dead space beside it. */
  .totals-box { display: block; margin-top: 22px; padding-top: 10px; border-top: 2px solid #111; }
  .totals-inner { min-width: 300px; margin-left: auto; border: 1px solid #cbd1d8;
    border-radius: 4px; padding: 8px 14px; }
  /* Free-text bill comment, printed full-width under the totals box. */
  .bill-comment { margin-top: 16px; border: 1px solid #cbd1d8; border-radius: 4px;
    padding: 7px 12px; font-size: 10px; line-height: 1.45; color: #111; white-space: pre-wrap; }
  .bill-comment .bill-comment-label { font-weight: bold; color: #555; }

  /* Double the breathing room between the totals box and the signature lines. */
  .signatures { margin-top: 80px; }

  @media print {
    /* Only the hospital box lives in .print-header now, and it sits in the
       doc-grid <thead>. Give it an explicit height + overflow:hidden — same
       recipe as IpdDischarge's .page-header — so Chrome can resolve its size
       and repeat it on every page (an auto-height header did not repeat once
       content overflowed). The header→body gap is the <thead> cell
       padding-bottom (DOC_GRID_CSS). */
    .print-header { position: static; height: 138px; overflow: hidden;
      padding: 0; margin: 0 0 8px; }
  }
  @media screen {
    .print-header { margin-bottom: 16px; }
  }
`;

function printDoctorServiceSlip(patient: any, entries: BillingEntry[], logo: string) {
  const body = wrapPrintDoc(
    printHeaderHtml(logo, "Doctor / Consultation Services"),
    [patientInfoBlock(patient), doctorServiceBoxHtml(entries, patient.referredBy, fmt, fmtDate)],
  );
  openIpdPrintWindow(`Doctor Services — ${patient.admissionId}`, body);
}

function totalsBlock(
  totalBedCharge: number, servicesGross: number, invTotal: number, pharmTotal: number,
  servicesDiscount: number, billDiscAmt: number, grandTotal: number,
  receiptSummary: ReceiptSummary | null,
  totalGst: number = 0, gstBreakdown: { label: string; amount: number }[] = [],
  discountSections: IpdDiscountSection[] = [],
  billComment: string = "",
  hideBillDiscount: boolean = false,
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
    ${discountSummaryHtml(discountSections)}
    <div class="totals-sep"></div>
    <div class="totals-row"><span>Net Total</span><span class="bold">${fmt(preDisc)}</span></div>
    ${billDiscAmt > 0 && !hideBillDiscount ? `<div class="totals-row" style="color:#ef4444"><span>(-)Bill Discount</span><span>${fmt(billDiscAmt)}</span></div>` : ""}
    ${totalGst > 0 ? `
    <div class="totals-row"><span>(+) GST</span><span class="bold">${fmt(totalGst)}</span></div>
    <div style="font-size:9px;color:#6b7280;line-height:1.5;padding:0 0 4px 8px">
      ${gstBreakdown.map(x => `${x.label}: ${fmt(x.amount)}`).join(" &middot; ")}
    </div>` : ""}
    <div class="totals-row"><span>Grand Total</span><span class="bold">${fmt(grandTotal)}</span></div>
    <div class="totals-row"><span>Total Paid Amount</span><span>${fmt(totalPaid)}</span></div>
    ${totalTds > 0 ? `<div class="totals-row"><span>TDS</span><span>${fmt(totalTds)}</span></div>` : ""}
    ${totalDis > 0 ? `<div class="totals-row"><span>Disallowed</span><span>${fmt(totalDis)}</span></div>` : ""}
    <div class="totals-grand"><span>Payable By Patient</span><span>${fmt(netDue)}</span></div>
  </div>
</div>
${billComment.trim() ? `<div class="bill-comment"><span class="bill-comment-label">Comment:</span> ${esc(billComment.trim())}</div>` : ""}
<div class="signatures">
  <div><div class="sig-line">Patient / Guardian</div></div>
  <div><div class="sig-line">Authorised Signatory</div></div>
</div>
<div class="signatures" style="margin-top:40px">
  <div><div class="sig-line" style="width:200px">Prepared By</div></div>
</div>`;
}

// Per-section "hide the discount from the printed bill" flags. Toggled on screen
// (see DiscountToggle); the on-screen tables are never affected, only the print.
export type DiscPrintHidden = {
  services: boolean;
  investigations: boolean;
  pharmacy: boolean;
  summary: boolean;
};
const NO_DISC_HIDDEN: DiscPrintHidden = { services: false, investigations: false, pharmacy: false, summary: false };

// Drops the discount rows the caller asked to hide from the Bill Summary block.
// `summary` hides every row; a section flag hides just that section's row. This
// is disclosure only — no total changes (Net Total is printed directly).
function visibleDiscountSections(
  entries: BillingEntry[], investigations: Investigation[], pharmBills: PharmBill[],
  hidden: DiscPrintHidden,
): IpdDiscountSection[] {
  if (hidden.summary) return [];
  return buildDiscountSections(entries, investigations, pharmBills).filter(s => {
    if (s.section === "Services" && hidden.services) return false;
    if (s.section === "Investigation" && hidden.investigations) return false;
    if (s.section === "Pharmacy" && hidden.pharmacy) return false;
    return true;
  });
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
  totalGst: number = 0,
  gstBreakdown: { label: string; amount: number }[] = [],
  discHidden: DiscPrintHidden = NO_DISC_HIDDEN,
) {
  let bedGstTotal = 0, invGstTotal = 0, pharmGstTotal = 0;
  const svcGstTotal = entries.reduce((s, e) => s + gstAmt(e.totalCharge, e.gst, e.gstType), 0);

  const doctorEntries  = entries.filter(e => e.doctorName);
  const regularEntries = entries.filter(e => !e.doctorName);

  // Hide a section's Discount column when it was toggled off for print, or when
  // no item in that section is discounted.
  const svcHasDisc   = !discHidden.services && regularEntries.some(e => e.unitCharge * e.quantity - e.totalCharge > 0.005);
  const pharmHasDisc = !discHidden.pharmacy && pharmBills.some(b => b.items.some((it: any) => Number(it.discount) > 0));
  const pharmSpan    = pharmHasDisc ? 7 : 6;

  const bedRows = bedAllotments.map(a => {
    const days = a.endDate && a.allotmentDate
      ? computeBillingDays(combineISTDateTime(a.allotmentDate, a.allotmentTime), combineISTDateTime(a.endDate, a.endTime))
      : (a.allotmentDate && estEndDate ? computeBillingDays(combineISTDateTime(a.allotmentDate, a.allotmentTime), estEndDate) : 1);
    const charge = days * a.charge;
    const g = gstAmt(charge, a.gst, a.gstType);
    bedGstTotal += g;
    return `<tr>
      <td>${fmtDate(a.allotmentDate)} ${a.allotmentTime || ""}</td>
      <td>${a.endDate ? fmtDate(a.endDate) + " " + (a.endTime || "") : "—"}</td>
      <td>${a.bedCategory}</td>
      <td class="center">${a.bedNo}</td>
      <td class="right">${fmt(a.charge)}</td>
      <td class="center">${days}</td>
      <td class="right bold">${fmt(charge)}</td>
      <td class="right">${g > 0 ? fmt(g) : "—"}</td>
    </tr>`;
  }).join("");

  const svcRowArr = regularEntries.map((e, i) => {
    const g = gstAmt(e.totalCharge, e.gst, e.gstType);
    const disc = e.unitCharge * e.quantity - e.totalCharge;
    return `
    <tr>
      <td>${i + 1}</td>
      <td>${e.serviceName}</td>
      <td class="sub">${e.serviceGroup}</td>
      <td class="center">${e.quantity}</td>
      <td class="right">${fmt(e.unitCharge)}</td>
      ${svcHasDisc ? `<td class="right">${disc > 0 ? `<span style="color:#ef4444">${fmt(disc)}</span>` : "—"}</td>` : ""}
      <td class="right bold">${fmt(e.totalCharge)}</td>
      <td class="right">${g > 0 ? fmt(g) : "—"}</td>
    </tr>`;
  });

  const doctorBox = doctorServiceBoxHtml(doctorEntries, patient.referredBy, fmt, fmtDate);

  const invRowArr = investigations.flatMap(inv =>
    (inv.items || []).filter(it => it.description).map(it => {
      const g = gstAmt(it.netAmount || 0, it.gst, it.gstType);
      invGstTotal += g;
      return `
    <tr>
      <td style="font-family:monospace;font-size:10px">${inv.reqNo}</td>
      <td>${fmtDate(inv.reqDate)}</td>
      <td>${it.description}</td>
      <td>${it.category || "—"}</td>
      <td class="right bold">${fmt(it.netAmount || 0)}</td>
      <td class="right">${g > 0 ? fmt(g) : "—"}</td>
    </tr>`;
    })
  );

  const pharmRowArr = pharmBills.flatMap(bill =>
    bill.items.map(it => {
      const g = gstAmt(it.netAmount, it.gst, it.gstType);
      pharmGstTotal += g;
      return `
    <tr>
      <td style="font-family:monospace;font-size:10px">${bill.vendorBillNo || "—"}</td>
      <td>${fmtDate(bill.billDate)}</td>
      <td>${it.itemName}</td>
      <td>${it.package || "—"}</td>
      <td class="center">${it.qty}</td>
      <td class="right">${fmt(parseFloat(String(it.mrp)) || 0)}</td>
      ${pharmHasDisc ? `<td class="center">${it.discount || 0}${it.discountType || "%"}</td>` : ""}
      <td class="right bold">${fmt(it.netAmount)}</td>
      <td class="right">${g > 0 ? fmt(g) : "—"}</td>
    </tr>`;
    })
  );

  const fallbackBedRow = !bedAllotments.length && fallbackBed ? `
    <tr>
      <td>${fmtDate(patient.admissionDate)} ${patient.admissionTime || ""}</td>
      <td>—</td>
      <td>${patient.bedCategory || "—"}</td>
      <td class="center">${patient.bedNo || "—"}</td>
      <td class="right">${fmt(fallbackBed.rate)}</td>
      <td class="center">${fallbackBed.days}</td>
      <td class="right bold">${fmt(fallbackBed.charge)}</td>
      <td class="right">—</td>
    </tr>` : "";

  const showBedSection = bedAllotments.length > 0 || (fallbackBed && fallbackBed.charge > 0);

  const svcHead = `<tr><th>#</th><th>Service</th><th>Group</th><th class="center">Qty</th><th class="right">Unit Rate</th>${svcHasDisc ? `<th class="right">Discount</th>` : ""}<th class="right">Amount</th><th class="right">GST</th></tr>`;
  const svcCols = svcHasDisc
    ? `<colgroup><col style="width:4%"><col style="width:28%"><col style="width:18%"><col style="width:6%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:8%"></colgroup>`
    : `<colgroup><col style="width:5%"><col style="width:33%"><col style="width:20%"><col style="width:7%"><col style="width:15%"><col style="width:12%"><col style="width:8%"></colgroup>`;
  const svcFoot = `<tr class="total-row"><td colspan="5">Nursing Home Charges</td>${svcHasDisc ? `<td class="right" style="color:#ef4444">${servicesDiscount > 0 ? fmt(servicesDiscount) : "—"}</td>` : ""}<td class="right">${fmt(servicesNet)}</td><td class="right">${svcGstTotal > 0 ? fmt(svcGstTotal) : "—"}</td></tr>`;

  const invHead = `<tr><th>Req No</th><th>Date</th><th>Description</th><th>Category</th><th class="right">Net Amt</th><th class="right">GST</th></tr>`;
  const invCols = `<colgroup><col style="width:14%"><col style="width:12%"><col style="width:36%"><col style="width:16%"><col style="width:12%"><col style="width:10%"></colgroup>`;
  const invFoot = `<tr class="total-row"><td colspan="4">Investigations Total</td><td class="right">${fmt(invTotal)}</td><td class="right">${invGstTotal > 0 ? fmt(invGstTotal) : "—"}</td></tr>`;

  const pharmHead = `<tr><th>Bill No</th><th>Date</th><th>Item</th><th>Package</th><th class="center">Qty</th><th class="right">MRP</th>${pharmHasDisc ? `<th class="center" style="white-space:nowrap">Discount</th>` : ""}<th class="right">Net Amt</th><th class="right">GST</th></tr>`;
  const pharmCols = pharmHasDisc
    ? `<colgroup><col style="width:10%"><col style="width:10%"><col style="width:19%"><col style="width:12%"><col style="width:6%"><col style="width:10%"><col style="width:12%"><col style="width:11%"><col style="width:10%"></colgroup>`
    : `<colgroup><col style="width:11%"><col style="width:11%"><col style="width:26%"><col style="width:13%"><col style="width:7%"><col style="width:11%"><col style="width:11%"><col style="width:10%"></colgroup>`;
  const pharmFoot = `${pharmacyReturn > 0 ? `<tr class="total-row"><td colspan="${pharmSpan}">Pharmacy Sub Total</td><td class="right">${fmt(pharmTotal + pharmacyReturn)}</td><td></td></tr><tr class="total-row"><td colspan="${pharmSpan}" style="color:#ef4444">(-) Pharmacy Return</td><td class="right" style="color:#ef4444">${fmt(pharmacyReturn)}</td><td></td></tr>` : ""}<tr class="total-row"><td colspan="${pharmSpan}">Pharmacy Total</td><td class="right">${fmt(pharmTotal)}</td><td class="right">${pharmGstTotal > 0 ? fmt(pharmGstTotal) : "—"}</td></tr>`;

  const { header: billHeader, intro: billIntro } = billHeaderHtml(logo, billType, patient);
  return wrapPrintDoc(billHeader, [
    billIntro,
    showBedSection ? `
<h2>Bed Details</h2>
<table>
  <thead><tr><th>From Date</th><th>To Date</th><th>Bed Category</th><th class="center">Bed No</th><th class="right">Rate/Day</th><th class="center">Days</th><th class="right">Charge</th><th class="right">GST</th></tr></thead>
  <tbody>
    ${bedRows || fallbackBedRow}
    <tr class="total-row"><td colspan="6">Total Bed Charge</td><td class="right">${fmt(totalBedCharge)}</td><td class="right">${bedGstTotal > 0 ? fmt(bedGstTotal) : "—"}</td></tr>
  </tbody>
</table>` : "",
    ...chunkTableSections("Services (Nursing Home Charges)", svcCols, svcHead, svcRowArr, svcFoot),
    doctorBox,
    ...(investigations.length > 0
      ? chunkTableSections("Investigations", invCols, invHead, invRowArr, invFoot) : []),
    ...(pharmBills.length > 0
      ? chunkTableSections("Pharmacy", pharmCols, pharmHead, pharmRowArr, pharmFoot) : []),
    totalsBlock(totalBedCharge, servicesGross, invTotal, pharmTotal, servicesDiscount, billDiscAmt, grandTotal, receiptSummary, totalGst, gstBreakdown,
      visibleDiscountSections(entries, investigations, pharmBills, discHidden), patient?.billComment || "", discHidden.summary),
  ]);
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
  entries: BillingEntry[],
  totalGst: number = 0,
  gstBreakdown: { label: string; amount: number }[] = [],
  discHidden: DiscPrintHidden = NO_DISC_HIDDEN,
) {
  let bedGstTotal = 0, invGstTotal = 0, pharmGstTotal = 0;
  const doctorBox = doctorServiceBoxHtml(entries.filter(e => e.doctorName), patient.referredBy, fmt, fmtDate);

  // Hide a section's Discount column when it was toggled off for print, or when
  // no item in that section is discounted.
  const grpHasDisc   = !discHidden.services && Object.values(serviceGroups).some(d => d.discount > 0);
  const pharmHasDisc = !discHidden.pharmacy && pharmBills.some((b: any) => b.items.some((it: any) => Number(it.discount) > 0));
  const pharmSpan    = pharmHasDisc ? 7 : 6;

  const bedSummaryRows = bedAllotments.length > 0
    ? bedAllotments.map(a => {
        const days = a.endDate && a.allotmentDate
          ? computeBillingDays(combineISTDateTime(a.allotmentDate, a.allotmentTime), combineISTDateTime(a.endDate, a.endTime))
          : (a.allotmentDate && estEndDate ? computeBillingDays(combineISTDateTime(a.allotmentDate, a.allotmentTime), estEndDate) : 1);
        const charge = days * a.charge;
        const g = gstAmt(charge, a.gst, a.gstType);
        bedGstTotal += g;
        return `<tr>
          <td>${a.bedCategory}</td>
          <td>${a.bedNo}</td>
          <td>${fmtDate(a.allotmentDate)}</td>
          <td>${a.endDate ? fmtDate(a.endDate) : "—"}</td>
          <td class="right">${fmt(a.charge)}</td>
          <td class="center">${days}</td>
          <td class="right bold">${fmt(charge)}</td>
          <td class="right">${g > 0 ? fmt(g) : "—"}</td>
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
        <td class="right">—</td>
      </tr>` : "");

  const svcGroupRows = Object.entries(serviceGroups).map(([grp, data]) => `
    <tr>
      <td>${grp}</td>
      <td class="right">${fmt(data.gross)}</td>
      ${grpHasDisc ? `<td class="right" style="color:#ef4444">${data.discount > 0 ? fmt(data.discount) : "—"}</td>` : ""}
      <td class="right bold">${fmt(data.net)}</td>
    </tr>`).join("");

  const invRowArr = investigations.flatMap(inv =>
    (inv.items || []).filter((it: any) => it.description).map((it: any) => {
      const g = gstAmt(it.netAmount || 0, it.gst, it.gstType);
      invGstTotal += g;
      return `
      <tr>
        <td style="font-family:monospace;font-size:10px">${inv.reqNo}</td>
        <td>${fmtDate(inv.reqDate)}</td>
        <td>${it.description}</td>
        <td>${it.category || "—"}</td>
        <td class="right bold">${fmt(it.netAmount || 0)}</td>
        <td class="right">${g > 0 ? fmt(g) : "—"}</td>
      </tr>`;
    })
  );
  const invHead = `<tr><th>Req No</th><th>Date</th><th>Description</th><th>Category</th><th class="right">Net Amt</th><th class="right">GST</th></tr>`;
  const invCols = `<colgroup><col style="width:14%"><col style="width:12%"><col style="width:36%"><col style="width:16%"><col style="width:12%"><col style="width:10%"></colgroup>`;
  const invFoot = `<tr class="total-row"><td colspan="4">Investigations Total</td><td class="right">${fmt(invTotal)}</td><td class="right">${invGstTotal > 0 ? fmt(invGstTotal) : "—"}</td></tr>`;

  const pharmRowArr = pharmBills.flatMap((bill: any) =>
    bill.items.map((it: any) => {
      const g = gstAmt(it.netAmount, it.gst, it.gstType);
      pharmGstTotal += g;
      return `
      <tr>
        <td style="font-family:monospace;font-size:10px">${bill.vendorBillNo || "—"}</td>
        <td>${fmtDate(bill.billDate)}</td>
        <td>${it.itemName}</td>
        <td>${it.package || "—"}</td>
        <td class="center">${it.qty}</td>
        <td class="right">${fmt(parseFloat(String(it.mrp)) || 0)}</td>
        ${pharmHasDisc ? `<td class="center">${it.discount || 0}${it.discountType || "%"}</td>` : ""}
        <td class="right bold">${fmt(it.netAmount)}</td>
        <td class="right">${g > 0 ? fmt(g) : "—"}</td>
      </tr>`;
    })
  );
  const pharmHead = `<tr><th>Bill No</th><th>Date</th><th>Item</th><th>Package</th><th class="center">Qty</th><th class="right">MRP</th>${pharmHasDisc ? `<th class="center" style="white-space:nowrap">Discount</th>` : ""}<th class="right">Net Amt</th><th class="right">GST</th></tr>`;
  const pharmCols = pharmHasDisc
    ? `<colgroup><col style="width:10%"><col style="width:10%"><col style="width:19%"><col style="width:12%"><col style="width:6%"><col style="width:10%"><col style="width:12%"><col style="width:11%"><col style="width:10%"></colgroup>`
    : `<colgroup><col style="width:11%"><col style="width:11%"><col style="width:26%"><col style="width:13%"><col style="width:7%"><col style="width:11%"><col style="width:11%"><col style="width:10%"></colgroup>`;
  const pharmFoot = `${pharmacyReturn > 0 ? `<tr class="total-row"><td colspan="${pharmSpan}">Pharmacy Sub Total</td><td class="right">${fmt(pharmTotal + pharmacyReturn)}</td><td></td></tr><tr class="total-row"><td colspan="${pharmSpan}" style="color:#ef4444">(-) Pharmacy Return</td><td class="right" style="color:#ef4444">${fmt(pharmacyReturn)}</td><td></td></tr>` : ""}<tr class="total-row"><td colspan="${pharmSpan}">Pharmacy Total</td><td class="right">${fmt(pharmTotal)}</td><td class="right">${pharmGstTotal > 0 ? fmt(pharmGstTotal) : "—"}</td></tr>`;

  const showBedSection = bedAllotments.length > 0 || (fallbackBed && fallbackBed.charge > 0);

  const { header: billHeader, intro: billIntro } = billHeaderHtml(logo, billType, patient);
  return wrapPrintDoc(billHeader, [
    billIntro,
    showBedSection ? `
<h2>Bed Details</h2>
<table>
  <thead><tr><th>Bed Category</th><th>Bed No</th><th>From</th><th>To</th><th class="right">Rate/Day</th><th class="center">Days</th><th class="right">Charge</th><th class="right">GST</th></tr></thead>
  <tbody>
    ${bedSummaryRows}
    <tr class="total-row"><td colspan="6">Total Bed Charge</td><td class="right">${fmt(totalBedCharge)}</td><td class="right">${bedGstTotal > 0 ? fmt(bedGstTotal) : "—"}</td></tr>
  </tbody>
</table>` : "",
    `
<h2>Services (Nursing Home Charges)</h2>
<table>
  <thead><tr><th>Service Group</th><th class="right">Gross</th>${grpHasDisc ? `<th class="right">Discount</th>` : ""}<th class="right">Net</th></tr></thead>
  <tbody>
    ${svcGroupRows}
    <tr class="total-row">
      <td>Total</td>
      <td class="right"></td>
      ${grpHasDisc ? `<td class="right" style="color:#ef4444">${servicesDiscount > 0 ? fmt(servicesDiscount) : "—"}</td>` : ""}
      <td class="right">${fmt(servicesNet)}</td>
    </tr>
  </tbody>
</table>`,
    doctorBox,
    ...(invTotal > 0
      ? chunkTableSections("Investigations", invCols, invHead, invRowArr, invFoot) : []),
    ...((pharmTotal > 0 || pharmacyReturn > 0)
      ? chunkTableSections("Pharmacy", pharmCols, pharmHead, pharmRowArr, pharmFoot) : []),
    totalsBlock(totalBedCharge, servicesGross, invTotal, pharmTotal, servicesDiscount, billDiscAmt, grandTotal, receiptSummary, totalGst, gstBreakdown,
      visibleDiscountSections(entries, investigations, pharmBills, discHidden), patient?.billComment || "", discHidden.summary),
  ]);
}

function GstBadge({ gst, gstType, onClick }: { gst?: number; gstType?: string; onClick: () => void }) {
  const has = Number(gst) > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs rounded px-1.5 py-0.5 border whitespace-nowrap transition-colors ${
        has
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "border-dashed border-gray-300 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
      }`}
    >
      {has ? `GST ${gstLabel(gst, gstType)}` : "+ GST"}
    </button>
  );
}

// Toggles whether a section's discount column(s) / the bill-summary discount
// rows are printed. The on-screen tables always show discounts; this only
// controls the printed bill. It never touches a total or any calculation.
function DiscountToggle({ hidden, onClick }: { hidden: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      title={
        hidden
          ? "This section's discount column is hidden on the printed bill — click to include it"
          : "Hide this section's discount column on the printed bill (screen is unaffected)"
      }
      className={`h-7 gap-1.5 text-xs font-medium ${
        hidden ? "border-amber-300 text-amber-700 hover:bg-amber-50" : "text-gray-600"
      }`}
    >
      {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      {hidden ? "Discount hidden in print" : "Hide discount in print"}
    </Button>
  );
}

type GstKind = "entry" | "bed" | "inv" | "pharm";
interface GstEditState {
  kind: GstKind;
  id: string;
  itemIndex?: number;
  label: string;
  base: number;
  gst: number;
  gstType: "percent" | "flat";
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
  const [billCommentInput,  setBillCommentInput]  = useState("");
  const [billCommentSaved,  setBillCommentSaved]  = useState("");
  const [savingBillComment, setSavingBillComment] = useState(false);
  const [estDate,    setEstDate]    = useState(() => todayIST());
  const [estTime,    setEstTime]    = useState(() => nowISTTime());
  const [estManual,  setEstManual]  = useState(false);
  const [estSaving,  setEstSaving]  = useState(false);
  const [gstEdit,    setGstEdit]    = useState<GstEditState | null>(null);
  const [gstInput,   setGstInput]   = useState("");
  const [gstTypeInput, setGstTypeInput] = useState<"percent" | "flat">("percent");
  const [savingGst,  setSavingGst]  = useState(false);

  // Print-only — when a flag is set, that section's discount column (or the
  // bill-summary discount rows) is omitted from the printed bill. The on-screen
  // tables always show discounts. Does NOT affect any total or calculation.
  const [discHidden, setDiscHidden] = useState({
    services: false,
    investigations: false,
    pharmacy: false,
    summary: false,
  });
  const allDiscHidden =
    discHidden.services && discHidden.investigations && discHidden.pharmacy && discHidden.summary;
  const toggleDisc = (key: keyof typeof discHidden) =>
    setDiscHidden(p => ({ ...p, [key]: !p[key] }));
  const toggleAllDisc = () => {
    const next = !allDiscHidden;
    setDiscHidden({ services: next, investigations: next, pharmacy: next, summary: next });
  };

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

        setBillCommentSaved(p.billComment || "");
        setBillCommentInput(p.billComment || "");

        if (p.estimateEndDate) {
          setEstDate(toISTDateStr(p.estimateEndDate));
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
      setEstDate(todayIST());
      setEstTime(nowISTTime());
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

  const doctorEntries    = entries.filter(e => e.doctorName);
  const doctorTotal      = doctorEntries.reduce((s, e) => s + e.totalCharge, 0);
  const servicesGross    = entries.reduce((s, e) => s + e.unitCharge * e.quantity, 0);
  const servicesDiscount = entries.reduce((s, e) => s + (e.unitCharge * e.quantity - e.totalCharge), 0);
  const servicesNet      = entries.reduce((s, e) => s + e.totalCharge, 0);
  const invTotal         = investigations.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const pharmGross       = pharmBills.reduce((s, b) => s + (b.netAmount || 0), 0);
  const pharmacyReturn   = patient.pharmacyReturn || 0;
  const pharmTotal       = Math.max(0, pharmGross - pharmacyReturn);

  // Per-section discount rows (services / investigation / pharmacy) for the Bill Summary
  const discountSections   = buildDiscountSections(entries, investigations, pharmBills);

  // Bed charge from allotments; fall back to patient bed × manually chosen estimate date
  const fallbackRate = (patient.bedCategory && !isBedChargeExempt(patient.department)) ? (BED_CHARGES[patient.bedCategory] ?? 0) : 0;
  const fallbackEndDate = patient.dischargeDate
    ? combineISTDateTime(patient.dischargeDate, patient.dischargeTime)
    : (estDate ? combineISTDateTime(estDate, estTime) : null);
  const fallbackDays = patient.admissionDate && fallbackEndDate
    ? computeBillingDays(combineISTDateTime(patient.admissionDate, patient.admissionTime), fallbackEndDate)
    : 1;
  const fallbackBed = bedAllotments.length === 0 && patient.bedCategory
    ? { rate: fallbackRate, days: fallbackDays, charge: fallbackRate * fallbackDays }
    : null;

  const openEndDate: Date = fallbackEndDate ?? new Date();
  const totalBedCharge = bedAllotments.length > 0
    ? bedAllotments.reduce((s, a) => {
        if (!a.allotmentDate) return s;
        const from = combineISTDateTime(a.allotmentDate, a.allotmentTime);
        const days = a.endDate
          ? computeBillingDays(from, combineISTDateTime(a.endDate, a.endTime))
          : computeBillingDays(from, openEndDate);
        return s + days * (a.charge || 0);
      }, 0)
    : (fallbackBed?.charge ?? 0);

  // GST — applied per item, summed on top of the grand total
  const bedGstItems = bedAllotments.map(a => {
    const from = a.allotmentDate ? combineISTDateTime(a.allotmentDate, a.allotmentTime) : null;
    const days = !from ? 1
      : a.endDate
        ? computeBillingDays(from, combineISTDateTime(a.endDate, a.endTime))
        : computeBillingDays(from, openEndDate);
    return { label: `Bed — ${a.bedCategory} (${a.bedNo})`, amount: gstAmt(days * (a.charge || 0), a.gst, a.gstType) };
  }).filter(x => x.amount > 0);
  const svcGstItems = entries
    .map(e => ({ label: e.serviceName, amount: gstAmt(e.totalCharge, e.gst, e.gstType) }))
    .filter(x => x.amount > 0);
  const invGstItems = investigations
    .flatMap(inv => (inv.items || []).map(it => ({ label: it.description, amount: gstAmt(it.netAmount || 0, it.gst, it.gstType) })))
    .filter(x => x.amount > 0);
  const pharmGstItems = pharmBills
    .flatMap(b => b.items.map(it => ({ label: it.itemName, amount: gstAmt(it.netAmount, it.gst, it.gstType) })))
    .filter(x => x.amount > 0);

  const bedGstTotal   = bedGstItems.reduce((s, x) => s + x.amount, 0);
  const svcGstTotal   = svcGstItems.reduce((s, x) => s + x.amount, 0);
  const invGstTotal   = invGstItems.reduce((s, x) => s + x.amount, 0);
  const pharmGstTotal = pharmGstItems.reduce((s, x) => s + x.amount, 0);
  const gstBreakdown  = [...bedGstItems, ...svcGstItems, ...invGstItems, ...pharmGstItems];
  const totalGst      = bedGstTotal + svcGstTotal + invGstTotal + pharmGstTotal;

  const totalCharge    = totalBedCharge + servicesGross + invTotal + pharmTotal;
  const preDiscTotal   = totalCharge - servicesDiscount;
  const billDiscAmt    = billDiscSaved != null
    ? (billDiscType === "percent" ? preDiscTotal * billDiscSaved / 100 : billDiscSaved)
    : 0;
  const grandTotal     = preDiscTotal - billDiscAmt + totalGst;
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

  const handleSaveBillComment = async () => {
    const val = billCommentInput.trim();
    setSavingBillComment(true);
    try {
      await ipdService.updatePatient(id!, { billComment: val });
      setBillCommentSaved(val);
      setBillCommentInput(val);
      setPatient((p: any) => (p ? { ...p, billComment: val } : p));
      toast.success(val ? "Bill comment saved" : "Bill comment cleared");
    } catch { toast.error("Failed to save comment"); }
    finally { setSavingBillComment(false); }
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
      setEstDate(todayIST());
      setEstTime(nowISTTime());
      toast.success("Reverted to live auto-increment");
    } catch { toast.error("Failed to clear"); }
    finally { setEstSaving(false); }
  };

  const openGstEdit = (state: GstEditState) => {
    setGstEdit(state);
    setGstInput(state.gst > 0 ? String(state.gst) : "");
    setGstTypeInput(state.gstType || "percent");
  };

  const applyGst = async (val: number, type: "percent" | "flat") => {
    if (!gstEdit) return;
    setSavingGst(true);
    try {
      if (gstEdit.kind === "entry") {
        await ipdService.updateBillingEntry(gstEdit.id, { gst: val, gstType: type });
        setEntries(prev => prev.map(e => e._id === gstEdit.id ? { ...e, gst: val, gstType: type } : e));
      } else if (gstEdit.kind === "bed") {
        await ipdService.updateBedAllotment(gstEdit.id, { gst: val, gstType: type });
        setBedAllotments(prev => prev.map(a => a._id === gstEdit.id ? { ...a, gst: val, gstType: type } : a));
      } else if (gstEdit.kind === "inv") {
        const inv = investigations.find(i => i._id === gstEdit.id);
        if (!inv) return;
        const items = inv.items.map((it, i) => i === gstEdit.itemIndex ? { ...it, gst: val, gstType: type } : it);
        await ipdService.updateInvestigation(gstEdit.id, { items });
        setInvestigations(prev => prev.map(i => i._id === gstEdit.id ? { ...i, items } : i));
      } else if (gstEdit.kind === "pharm") {
        const bill = pharmBills.find(b => b._id === gstEdit.id);
        if (!bill) return;
        const items = bill.items.map((it, i) => i === gstEdit.itemIndex ? { ...it, gst: val, gstType: type } : it);
        await ipdService.updatePharmacyBill(gstEdit.id, { items });
        setPharmBills(prev => prev.map(b => b._id === gstEdit.id ? { ...b, items } : b));
      }
      setGstEdit(null);
      toast.success(val > 0 ? "GST saved" : "GST removed");
    } catch { toast.error("Failed to save GST"); }
    finally { setSavingGst(false); }
  };

  const handleSaveGst = () => {
    const val = Number(gstInput);
    if (isNaN(val) || val < 0) return toast.error("Enter a valid GST value");
    if (gstTypeInput === "percent" && val > 100) return toast.error("Percentage cannot exceed 100");
    applyGst(val, gstTypeInput);
  };

  const handleClearGst = () => applyGst(0, gstTypeInput);

  const handlePrintDetailed = () =>
    openIpdPrintWindow(
      `${billLabel} — ${patient.admissionId}`,
      buildDetailedBillHtml(
        billLabel, patient, entries, investigations, bedAllotments, pharmBills,
        fallbackBed, fallbackEndDate,
        totalBedCharge, servicesDiscount, servicesGross, servicesNet,
        invTotal, pharmTotal, pharmacyReturn, billDiscAmt, grandTotal, receiptSummary, logoUrl,
        totalGst, gstBreakdown, discHidden,
      ),
      BILL_PRINT_CSS,
    );

  const handlePrintSummary = () =>
    openIpdPrintWindow(
      `${billLabel} (Summary) — ${patient.admissionId}`,
      buildSummaryBillHtml(
        billLabel, patient, bedAllotments, fallbackBed, fallbackEndDate,
        totalBedCharge,
        Object.fromEntries(Object.entries(serviceGroups).map(([k, v]) => [k, { gross: v.gross, discount: v.discount, net: v.net }])),
        servicesDiscount, servicesGross, servicesNet, invTotal, pharmTotal, pharmacyReturn, billDiscAmt, grandTotal, receiptSummary, logoUrl,
        investigations, pharmBills, entries, totalGst, gstBreakdown, discHidden,
      ),
      BILL_PRINT_CSS,
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
          <Button variant="outline" className="gap-2"
            onClick={toggleAllDisc}
            title="Show / hide every discount column & the Bill Summary discount rows on the PRINTED bill. The screen always shows discounts; no total changes.">
            {allDiscHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {allDiscHidden ? "Show All Discounts in Print" : "Hide All Discounts in Print"}
          </Button>
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
                      <th className="text-right px-4 py-2 font-medium">GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bedAllotments.map(a => {
                      const from = a.allotmentDate ? combineISTDateTime(a.allotmentDate, a.allotmentTime) : null;
                      const days = !from ? 1
                        : a.endDate
                          ? computeBillingDays(from, combineISTDateTime(a.endDate, a.endTime))
                          : computeBillingDays(from, openEndDate);
                      const bedCharge = days * a.charge;
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
                          <td className="px-4 py-2 text-right font-semibold text-indigo-700">{fmt(bedCharge)}</td>
                          <td className="px-4 py-2 text-right">
                            <GstBadge gst={a.gst} gstType={a.gstType} onClick={() => openGstEdit({
                              kind: "bed", id: a._id, label: `Bed — ${a.bedCategory} (${a.bedNo})`,
                              base: bedCharge, gst: a.gst || 0, gstType: a.gstType || "percent",
                            })} />
                          </td>
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
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Service Details</CardTitle>
                <DiscountToggle hidden={discHidden.services} onClick={() => toggleDisc("services")} />
              </div>
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

          {/* Doctor / Consultation Services — kept separate since these carry doctor/date/referral info */}
          {doctorEntries.length > 0 && (
            <Card className="ring-indigo-200">
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Stethoscope className="h-4 w-4 text-indigo-600" />
                  Doctor / Consultation Services
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                    {doctorEntries.length}
                  </span>
                </CardTitle>
                <CardAction>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                    onClick={() => printDoctorServiceSlip(patient, doctorEntries, logoUrl)}
                    title="Print all doctor / consultation services"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-[11px] uppercase tracking-wide text-gray-400">
                      <th className="px-4 py-2 text-left font-medium">Service</th>
                      <th className="px-4 py-2 text-left font-medium">Doctor</th>
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                      <th className="px-4 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {doctorEntries.map(e => (
                      <tr key={e._id} className="hover:bg-indigo-50/40">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{e.serviceName}</td>
                        <td className="px-4 py-2.5">
                          <div className="text-gray-700">{e.doctorName || "—"}</div>
                          {patient.referredBy && (
                            <div className="text-xs text-gray-400">Ref: {patient.referredBy}</div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{fmtDate(e.date)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-indigo-700">{fmt(e.totalCharge)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-700" colSpan={3}>
                        Total Consultation Charge
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold text-indigo-700">{fmt(doctorTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Investigations */}
          {investigations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Investigations</CardTitle>
                  <DiscountToggle hidden={discHidden.investigations} onClick={() => toggleDisc("investigations")} />
                </div>
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
                            <th className="px-4 py-1 text-right font-medium">GST</th>
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
                              <td className="px-4 py-1.5 text-right">
                                <GstBadge gst={it.gst} gstType={it.gstType} onClick={() => openGstEdit({
                                  kind: "inv", id: inv._id, itemIndex: i, label: it.description,
                                  base: it.netAmount || 0, gst: it.gst || 0, gstType: it.gstType || "percent",
                                })} />
                              </td>
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
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Pharmacy</CardTitle>
                  <DiscountToggle hidden={discHidden.pharmacy} onClick={() => toggleDisc("pharmacy")} />
                </div>
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
                          <th className="px-4 py-1 text-right font-medium">GST</th>
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
                            <td className="px-4 py-1.5 text-right">
                              <GstBadge gst={it.gst} gstType={it.gstType} onClick={() => openGstEdit({
                                kind: "pharm", id: bill._id, itemIndex: i, label: it.itemName,
                                base: it.netAmount || 0, gst: it.gst || 0, gstType: it.gstType || "percent",
                              })} />
                            </td>
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
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Bill Summary</CardTitle>
                <DiscountToggle hidden={discHidden.summary} onClick={() => toggleDisc("summary")} />
              </div>
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
                  {discountSections.map(sec => (
                    <div key={sec.section} className="flex justify-between text-red-600">
                      <span>(-){sec.section} Discount</span>
                      <span className="font-semibold">{fmt(sec.total)}</span>
                    </div>
                  ))}
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

                  {/* Bill-level comment — printed at the end of the bill */}
                  <div className="border rounded-md bg-gray-50 px-3 py-2 space-y-2 mt-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-600">Bill Comment</span>
                      {billCommentSaved && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          saved · prints on bill
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={billCommentInput}
                      onChange={e => setBillCommentInput(e.target.value)}
                      placeholder="Add a comment to show at the end of the printed bill…"
                      rows={2}
                      className="text-xs resize-y"
                    />
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                        onClick={handleSaveBillComment}
                        disabled={savingBillComment || billCommentInput.trim() === billCommentSaved.trim()}>
                        {savingBillComment ? "…" : "Save"}
                      </Button>
                      {billCommentSaved && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500"
                          onClick={() => { setBillCommentInput(""); handleSaveBillComment(); }}
                          disabled={savingBillComment}>
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {totalGst > 0 && (
                    <div className="border rounded-md bg-emerald-50 border-emerald-200 px-3 py-2 space-y-1">
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span>(+) GST</span>
                        <span>{fmt(totalGst)}</span>
                      </div>
                      <div className="text-xs text-emerald-700/80 space-y-0.5">
                        {gstBreakdown.map((x, i) => (
                          <div key={i} className="flex justify-between gap-2">
                            <span className="truncate">{x.label}</span>
                            <span className="shrink-0">{fmt(x.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">All Service Entries</CardTitle>
                <DiscountToggle hidden={discHidden.services} onClick={() => toggleDisc("services")} />
              </div>
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
                      <th className="text-right px-3 py-2 font-medium">GST</th>
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
                        <td className="px-3 py-1.5 text-right">
                          <GstBadge gst={e.gst} gstType={e.gstType} onClick={() => openGstEdit({
                            kind: "entry", id: e._id, label: e.serviceName,
                            base: e.totalCharge, gst: e.gst || 0, gstType: e.gstType || "percent",
                          })} />
                        </td>
                        <td className="px-3 py-1.5 text-gray-400 text-xs">{e.doctorName || ""}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-gray-50 font-semibold">
                      <td colSpan={4} className="px-3 py-2">Services Total</td>
                      <td className="px-3 py-2 text-center">{entries.reduce((s, e) => s + e.quantity, 0)}</td>
                      <td className="px-3 py-2 text-right">{fmt(servicesNet)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{servicesDiscount > 0 ? fmt(servicesDiscount) : "—"}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{svcGstTotal > 0 ? fmt(svcGstTotal) : "—"}</td>
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
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Investigation Items</CardTitle>
                  <DiscountToggle hidden={discHidden.investigations} onClick={() => toggleDisc("investigations")} />
                </div>
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
                      <th className="text-right px-3 py-2 font-medium">GST</th>
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
                          <td className="px-3 py-1.5 text-right">
                            <GstBadge gst={it.gst} gstType={it.gstType} onClick={() => openGstEdit({
                              kind: "inv", id: inv._id, itemIndex: i, label: it.description,
                              base: it.netAmount || 0, gst: it.gst || 0, gstType: it.gstType || "percent",
                            })} />
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="border-t-2 bg-gray-50 font-semibold">
                      <td colSpan={5} className="px-3 py-2">Investigations Total</td>
                      <td className="px-3 py-2 text-right text-purple-700">{fmt(invTotal)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{invGstTotal > 0 ? fmt(invGstTotal) : "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {pharmBills.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Pharmacy Items</CardTitle>
                  <DiscountToggle hidden={discHidden.pharmacy} onClick={() => toggleDisc("pharmacy")} />
                </div>
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
                      <th className="text-right px-3 py-2 font-medium">GST</th>
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
                          <td className="px-3 py-1.5 text-right">
                            <GstBadge gst={it.gst} gstType={it.gstType} onClick={() => openGstEdit({
                              kind: "pharm", id: bill._id, itemIndex: i, label: it.itemName,
                              base: it.netAmount || 0, gst: it.gst || 0, gstType: it.gstType || "percent",
                            })} />
                          </td>
                        </tr>
                      ))
                    )}
                    {pharmacyReturn > 0 && (
                      <>
                        <tr className="border-t bg-gray-50">
                          <td colSpan={7} className="px-3 py-2">Pharmacy Sub Total</td>
                          <td className="px-3 py-2 text-right">{fmt(pharmGross)}</td>
                          <td></td>
                        </tr>
                        <tr className="border-t bg-gray-50">
                          <td colSpan={7} className="px-3 py-2 text-red-500">(-) Pharmacy Return</td>
                          <td className="px-3 py-2 text-right text-red-500">{fmt(pharmacyReturn)}</td>
                          <td></td>
                        </tr>
                      </>
                    )}
                    <tr className="border-t-2 bg-gray-50 font-semibold">
                      <td colSpan={7} className="px-3 py-2">Pharmacy Total</td>
                      <td className="px-3 py-2 text-right text-green-700">{fmt(pharmTotal)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{pharmGstTotal > 0 ? fmt(pharmGstTotal) : "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog />

      <Dialog open={!!gstEdit} onOpenChange={open => { if (!open) setGstEdit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>GST — {gstEdit?.label}</DialogTitle>
          </DialogHeader>
          {gstEdit && (
            <div className="space-y-3">
              <div className="text-xs text-gray-500">Base amount: <span className="font-medium text-gray-700">{fmt(gstEdit.base)}</span></div>
              <div className="flex items-center gap-1.5">
                <div className="flex rounded-md border overflow-hidden shrink-0">
                  <button type="button"
                    onClick={() => setGstTypeInput("percent")}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${gstTypeInput === "percent" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                    %
                  </button>
                  <button type="button"
                    onClick={() => setGstTypeInput("flat")}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${gstTypeInput === "flat" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                    ₹
                  </button>
                </div>
                <Input
                  type="number" min={0} max={gstTypeInput === "percent" ? 100 : undefined}
                  value={gstInput}
                  onChange={e => setGstInput(e.target.value)}
                  placeholder="0"
                  className="h-8 text-sm"
                />
              </div>
              {gstInput && !isNaN(Number(gstInput)) && Number(gstInput) > 0 && (
                <div className="text-xs text-gray-500">
                  GST amount: <span className="font-medium text-emerald-700">{fmt(gstAmt(gstEdit.base, Number(gstInput), gstTypeInput))}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {gstEdit && Number(gstEdit.gst) > 0 && (
              <Button variant="ghost" className="text-gray-500" onClick={handleClearGst} disabled={savingGst}>
                Remove GST
              </Button>
            )}
            <Button onClick={handleSaveGst} disabled={savingGst} className="bg-indigo-600 hover:bg-indigo-700">
              {savingGst ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
