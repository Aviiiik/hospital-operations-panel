import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Printer, Trash2, Receipt, IndianRupee, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import ipdService, { RECEIPT_MODES, BED_CHARGES, computeBillingDays, combineISTDateTime, isBedChargeExempt, todayIST, buildDiscountSections, type IpdDiscountSection } from "@/services/ipdService";
import logoUrl from "@/assets/logo.png";
import { printViaHiddenIframe, wrapPrintDoc, hospitalHeaderHtml, DOC_GRID_CSS, HOSPITAL_HEADER_CSS } from "@/lib/ipdPrint";

function todayStr() { return todayIST(); }
function fmt(n: number) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}
function fmtAmt(n: number) {
  return Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}
function fmtDate(d: string | Date | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateShort(d: string | Date | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
}
function gstAmt(base: number, gst?: number, gstType?: string): number {
  const g = Number(gst) || 0;
  if (g <= 0) return 0;
  return gstType === "flat" ? g : (base * g) / 100;
}

// ── Amount in words ───────────────────────────────────────────────────────────
function toWords(n: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
    "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function below100(x: number) { return x < 20 ? ones[x] : tens[Math.floor(x/10)] + (x%10 ? " "+ones[x%10] : ""); }
  function below1000(x: number) { return x<100 ? below100(x) : ones[Math.floor(x/100)]+" Hundred"+(x%100?" "+below100(x%100):""); }
  if (!n || n <= 0) return "Zero";
  const whole = Math.round(n);
  let r = "", rem = whole;
  const cr = Math.floor(rem/10000000); rem %= 10000000;
  const lk = Math.floor(rem/100000);  rem %= 100000;
  const th = Math.floor(rem/1000);    rem %= 1000;
  if (cr) r += below1000(cr)+" Crore ";
  if (lk) r += below100(lk)+" Lakh ";
  if (th) r += below1000(th)+" Thousand ";
  if (rem) r += below1000(rem);
  return r.trim();
}

const PRINT_CSS = `
  ${DOC_GRID_CSS}
  ${HOSPITAL_HEADER_CSS}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:12px;color:#333;padding:24px}
  .title{text-align:center;font-size:16px;font-weight:bold;text-decoration:underline;margin-bottom:14px;letter-spacing:0.05em}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:14px;font-size:11px}
  .meta .lbl{color:#555;display:inline}
  .meta .val{font-weight:600;display:inline;margin-left:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:10px}
  th{background:#f3f4f6;padding:6px 10px;text-align:left;border:1px solid #aaa;font-size:11px}
  th.right{text-align:right}
  td{padding:5px 10px;border:1px solid #ccc;vertical-align:top;font-size:11px}
  td.right{text-align:right;white-space:nowrap}
  .words-box{border:1px solid #555;padding:8px 12px;font-size:11px;margin-bottom:14px;font-style:italic}
  .footer{display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:30px}
  .sig{display:flex;justify-content:space-between;margin-top:20px}
  .sig-line{border-top:1px solid #9ca3af;padding-top:4px;width:150px;text-align:center;font-size:11px;color:#4b5563}
  .page-footer{font-size:9px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:4px}
  @media print{
    body{padding:0}
    /* .print-header rides in the doc-grid <thead> (repeats every page). The
       .page-footer is fixed to the paper bottom and painted into the strip the
       <tfoot> spacer reserves, so it repeats without overlapping content. */
    .print-header{margin-bottom:8px}
    .page-footer{position:fixed;left:20px;right:20px;bottom:0;background:#fff;
      height:30px;display:flex;align-items:flex-end;justify-content:center;padding:0 0 6px}
    @page{margin:20px 20px}
  }
  @media screen{
    .doc-grid > tfoot{display:none}
    .page-footer{margin-top:24px}
  }
`;

interface ReceiptEntry {
  _id: string;
  receiptNo: string;
  receiptDate: string;
  receiptAmount: number;
  receiptMode: string;
  remarks?: string;
  tds?: number;
  disallowed?: number;
  refund?: number;
  chequeNo?: string;
  chequeRefNo?: string;
  transactionId?: string;
  bank?: string;
}

const BLANK = {
  receiptDate:   todayStr(),
  receiptAmount: 0,
  receiptMode:   "CASH",
  remarks:       "",
  tds:           0,
  disallowed:    0,
  refund:        0,
  chequeNo:      "",
  chequeRefNo:   "",
  transactionId: "",
  bank:          "",
};

// ── Single receipt print ──────────────────────────────────────────────────────
function printReceipt(patient: any, receipt: ReceiptEntry, _totalReceived: number, logo: string) {
  const now = new Date();
  const printDt = now.toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Asia/Kolkata"})
    + " " + now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Asia/Kolkata"});
  // Optional columns — each rendered only when the receipt actually carries a value.
  const optCols: { th: string; td: string }[] = [];
  if (receipt.transactionId) optCols.push({ th: "Txn ID",    td: receipt.transactionId });
  if (receipt.chequeNo)      optCols.push({ th: "Cheque No", td: receipt.chequeNo });
  if (receipt.chequeRefNo)   optCols.push({ th: "Ref",       td: receipt.chequeRefNo });
  if (receipt.bank)          optCols.push({ th: "Bank",      td: receipt.bank });
  const css = `${PRINT_CSS}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 32px;border-bottom:1px solid #e5e7eb;padding-bottom:10px;margin-bottom:12px}
  .il{font-size:10px;color:#6b7280}.iv{font-weight:600;font-size:12px}
  .total-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-top:10px}
  .total-label{font-size:13px;font-weight:bold;color:#1d4ed8}.total-amt{font-size:22px;font-weight:bold;color:#1e40af}`;

  const detailSection = `
<div class="info-grid">
  <div><div class="il">Receipt No</div><div class="iv" style="font-family:monospace">${receipt.receiptNo}</div></div>
  <div><div class="il">Receipt Date</div><div class="iv">${fmtDate(receipt.receiptDate)}</div></div>
  <div><div class="il">Patient Name</div><div class="iv">${patient.title} ${patient.name}</div></div>
  <div><div class="il">Admission ID</div><div class="iv" style="font-family:monospace">${patient.admissionId}</div></div>
  <div><div class="il">Adm Date</div><div class="iv">${fmtDate(patient.admissionDate)}</div></div>
  <div><div class="il">Address</div><div class="iv">${patient.address || "—"}</div></div>
  <div><div class="il">Sex / Age</div><div class="iv">${patient.gender} / ${patient.ageYears}Y</div></div>
  <div><div class="il">Attended By</div><div class="iv">${patient.doctors?.map((d: any) => d.doctorName).join(", ") || "—"}</div></div>
</div>
<table>
  <thead><tr><th>Receipt No</th><th>Date</th><th>Mode</th>${optCols.map(c => `<th>${c.th}</th>`).join("")}<th>Remarks</th><th class="right">Amount</th></tr></thead>
  <tbody>
    <tr>
      <td style="font-family:monospace">${receipt.receiptNo}</td>
      <td>${fmtDate(receipt.receiptDate)}</td>
      <td>${receipt.receiptMode}</td>
      ${optCols.map(c => `<td>${c.td}</td>`).join("")}
      <td>${receipt.remarks || "—"}</td>
      <td class="right" style="font-weight:bold">${fmtAmt(receipt.receiptAmount)}</td>
    </tr>
  </tbody>
</table>
<div style="margin-top:10px;margin-left:auto;width:260px;font-size:11px">
  ${receipt.tds ? `<div style="display:flex;justify-content:space-between;padding:1px 0"><span>TDS</span><span>${fmt(receipt.tds)}</span></div>` : ""}
  ${receipt.disallowed ? `<div style="display:flex;justify-content:space-between;padding:1px 0"><span>Disallowed</span><span>${fmt(receipt.disallowed)}</span></div>` : ""}
  <div style="display:flex;justify-content:space-between;padding:1px 0"><span>This Receipt</span><span>${fmt(receipt.receiptAmount)}</span></div>
</div>
<div class="total-box">
  <div class="total-label">Amount Received</div>
  <div class="total-amt">${fmt(receipt.receiptAmount)}</div>
</div>
<div class="words-box" style="margin-top:10px">(Amount Received : Rupees ${toWords(receipt.receiptAmount)} Only)</div>`;

  const signSection = `
<div class="footer"><span>Print Date : ${printDt}</span></div>
<div class="sig">
  <div><div class="sig-line">Patient / Guardian</div></div>
  <div style="text-align:right"><div style="font-size:11px;margin-bottom:20px">E &amp; O.E.</div><div class="sig-line" style="margin-left:auto">Authorised Signatory</div></div>
</div>`;

  const body = wrapPrintDoc(hospitalHeaderHtml(logo),
    [`<div class="doc-title">Receipt</div>`, detailSection, signSection],
    `<div class="page-footer">Arogya Maternity &amp; Nursing Home — Computer generated receipt</div>`);

  printViaHiddenIframe(`Receipt ${receipt.receiptNo}`, css, body);
}

interface ChargeData {
  bedTotal: number;
  servicesGross: number;
  servicesNet: number;
  invTotal: number;
  pharmTotal: number;
  billDiscAmt: number;
  totalGst: number;
  gstBreakdown: { label: string; amount: number }[];
  discountSections: IpdDiscountSection[];
  grandTotal: number;
}

// ── Consolidated money receipt print (all receipts) ───────────────────────────
function printAllReceipts(
  patient: any,
  receipts: ReceiptEntry[],
  charges: ChargeData,
  logo: string,
) {
  if (!receipts.length) { toast.error("No receipts to print"); return; }
  const totalReceived = receipts.reduce((s, r) => s + (r.receiptAmount || 0), 0);
  const totalTds      = receipts.reduce((s, r) => s + (r.tds        || 0), 0);
  const totalDis      = receipts.reduce((s, r) => s + (r.disallowed || 0), 0);
  const grandTotal    = charges.grandTotal;
  const netDue        = Math.max(0, grandTotal - totalReceived - totalTds - totalDis);

  const now = new Date();
  const printDt = now.toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Asia/Kolkata"})
    + " " + now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Asia/Kolkata"});
  const admDt     = patient.admissionDate ? fmtDateShort(patient.admissionDate) : "—";
  const invoiceDt = now.toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Asia/Kolkata"});
  const invoiceTm = now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Kolkata"});
  const ageStr = [
    patient.ageYears  ? patient.ageYears  + " Year"  : "",
    patient.ageMonths ? patient.ageMonths + " Month" : "",
    patient.ageDays   ? patient.ageDays   + " Day"   : "",
  ].filter(Boolean).join(" ") || "—";

  const chargeRows = [
    ...charges.discountSections.map(sec =>
      `<tr><td style="color:#c00">(-) ${sec.section} Discount</td><td class="right" style="color:#c00">(${fmtAmt(sec.total)})</td></tr>`),
    charges.billDiscAmt > 0
      ? `<tr><td style="color:#c00">(-) Bill Discount</td><td class="right" style="color:#c00">(${fmtAmt(charges.billDiscAmt)})</td></tr>` : "",
    charges.totalGst > 0
      ? `<tr><td>(+) GST</td><td class="right">${fmtAmt(charges.totalGst)}</td></tr>` : "",
    charges.totalGst > 0
      ? `<tr><td colspan="2" style="font-size:9px;color:#6b7280;border-top:none">${charges.gstBreakdown.map(x => `${x.label}: ${fmtAmt(x.amount)}`).join(" &middot; ")}</td></tr>` : "",
  ].filter(Boolean).join("");

  const paymentRows = receipts.map(r => {
    const line1 = `${fmtDateShort(r.receiptDate)}, Received: ${fmtAmt(r.receiptAmount)}, ${r.receiptMode}${r.remarks ? ", " + r.remarks : ""}`;
    const ref = r.transactionId || r.chequeNo || r.bank
      ? `(${[r.transactionId, r.chequeNo ? "Cheque: "+r.chequeNo : "", r.chequeRefNo, r.bank ? "Bank: "+r.bank : ""].filter(Boolean).join(" | ")})`
      : "";
    return `<tr>
      <td>${line1}${ref ? `<br/><span style="color:#555">${ref}</span>` : ""}</td>
      <td class="right"></td>
    </tr>`;
  }).join("");

  const css = PRINT_CSS;

  const metaSection = `
<div class="title">MONEY RECEIPT</div>
<div class="meta">
  <div><span class="lbl">Voucher No.</span><span class="val">${receipts[0].receiptNo}</span></div>
  <div style="text-align:right"><span class="lbl">Invoice No. :</span><span class="val">${patient.admissionId}</span></div>
  <div><span class="lbl">Voucher Date</span><span class="val">${fmtDateShort(receipts[receipts.length-1].receiptDate)}</span></div>
  <div style="text-align:right"><span class="lbl">Invoice Dt/Tm :</span><span class="val">${invoiceDt} &nbsp; ${invoiceTm}</span></div>
  <div><span class="lbl">Received From</span><span class="val">${patient.title} ${patient.name} ( ${patient.admissionId} of ${admDt} )</span></div>
  <div style="text-align:right">
    <div><span class="lbl">Patient Id :</span><span class="val">${patient.admissionId}</span></div>
    <div style="margin-top:3px"><span class="lbl">Gender/Age :</span><span class="val">${patient.gender || "—"} / ${ageStr}</span></div>
  </div>
</div>`;

  const tableSection = `
<table>
  <thead>
    <tr><th style="width:75%">Description</th><th class="right" style="width:25%">Amount(Rs.)</th></tr>
  </thead>
  <tbody>
    ${chargeRows}
    <tr><td colspan="2" style="padding:2px;border:none;background:#fff"></td></tr>
    <tr style="background:#f0fdf4;font-weight:bold">
      <td>Received Amount</td>
      <td class="right">${fmtAmt(totalReceived)}</td>
    </tr>
    ${paymentRows}
    ${totalTds > 0 ? `<tr><td style="color:#555">TDS Adjusted</td><td class="right" style="color:#555">${fmtAmt(totalTds)}</td></tr>` : ""}
    ${totalDis > 0 ? `<tr><td style="color:#555">Disallowed</td><td class="right" style="color:#555">${fmtAmt(totalDis)}</td></tr>` : ""}
    ${netDue > 0 ? `<tr style="font-weight:bold;background:#fff7ed">
      <td>Balance Due</td>
      <td class="right" style="color:#b91c1c">${fmtAmt(netDue)}</td>
    </tr>` : ""}
  </tbody>
</table>`;

  const signSection = `
<div class="words-box">(Amount Received : Rupees ${toWords(totalReceived)} Only)</div>
<div class="footer">
  <span>Print Date : ${printDt}</span>
  <span>E &amp; O.E.</span>
</div>
<div class="sig">
  <div><div class="sig-line">Patient / Guardian</div></div>
  <div><div class="sig-line">Signature</div></div>
</div>`;

  const body = wrapPrintDoc(hospitalHeaderHtml(logo), [metaSection, tableSection, signSection],
    `<div class="page-footer">Arogya Maternity &amp; Nursing Home — Computer generated document</div>`);

  printViaHiddenIframe(`Money Receipt — ${patient.admissionId}`, css, body);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function IpdReceipt() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();

  const [patient,       setPatient]       = useState<any>(null);
  const [receipts,      setReceipts]      = useState<ReceiptEntry[]>([]);
  const [billSummary,   setBillSummary]   = useState<{ gross: number; discount: number; net: number; count: number } | null>(null);
  const [entries,       setEntries]       = useState<any[]>([]);
  const [bedAllotments, setBedAllotments] = useState<any[]>([]);
  const [investigations,setInvestigations]= useState<any[]>([]);
  const [pharmBills,    setPharmBills]    = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [showForm,      setShowForm]      = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [form,          setForm]          = useState({ ...BLANK });
  const [liveNow,       setLiveNow]       = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setLiveNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      ipdService.getPatient(id),
      ipdService.getReceipts(id),
      ipdService.getBillingSummary(id),
      ipdService.getBillingEntries(id),
      ipdService.getBedAllotments(id),
      ipdService.getInvestigations(id),
      ipdService.getPharmacyBills(id),
    ]).then(([pr, rr, br, entR, asr, invR, phR]) => {
      setPatient(pr.data.data);
      setReceipts(rr.data.data.receipts || []);
      setBillSummary(br.data.data);
      setEntries(entR.data.data.entries || []);
      setBedAllotments(asr.data.data.allotments || []);
      setInvestigations(invR.data.data.investigations || []);
      setPharmBills(phR.data.data.bills || []);
    }).catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }));

  const totalReceived   = receipts.reduce((s, r) => s + (r.receiptAmount || 0), 0);
  const totalTds        = receipts.reduce((s, r) => s + (r.tds        || 0), 0);
  const totalDisallowed = receipts.reduce((s, r) => s + (r.disallowed || 0), 0);
  const totalRefund     = receipts.reduce((s, r) => s + (r.refund     || 0), 0);
  const servicesGross   = billSummary?.gross    ?? 0;
  const servicesDis     = billSummary?.discount ?? 0;

  const openEndDate = patient?.dischargeDate
    ? combineISTDateTime(patient.dischargeDate, patient.dischargeTime)
    : patient?.estimateEndDate
      ? combineISTDateTime(patient.estimateEndDate, patient.estimateEndTime)
      : liveNow;

  const computedBedTotal = bedAllotments.length > 0
    ? bedAllotments.reduce((s: number, a: any) => {
        const from = a.allotmentDate ? combineISTDateTime(a.allotmentDate, a.allotmentTime) : null;
        const days = !from ? 1
          : a.endDate
            ? computeBillingDays(from, combineISTDateTime(a.endDate, a.endTime))
            : computeBillingDays(from, openEndDate);
        return s + days * (a.charge || 0);
      }, 0)
    : (() => {
        const rate = (patient?.bedCategory && !isBedChargeExempt(patient?.department)) ? (BED_CHARGES[patient.bedCategory as string] ?? 0) : 0;
        const days = patient?.admissionDate
          ? computeBillingDays(combineISTDateTime(patient.admissionDate, patient.admissionTime), openEndDate)
          : 1;
        return rate * days;
      })();

  const bedTotal      = patient?.bedChargeOverride != null ? patient.bedChargeOverride : computedBedTotal;
  const invTotal      = investigations.reduce((s: number, i: any) => s + (i.totalAmount || 0), 0);
  const pharmGross     = pharmBills.reduce((s: number, b: any) => s + (b.netAmount || 0), 0);
  const pharmacyReturn = patient?.pharmacyReturn || 0;
  const pharmTotal      = Math.max(0, pharmGross - pharmacyReturn);

  // Per-section discount rows (services / investigation / pharmacy) for the Bill Summary
  const discountSections = buildDiscountSections(entries, investigations, pharmBills, servicesDis);

  // GST — mirrors IpdBilling.tsx so both pages always agree
  const bedGstItems = bedAllotments.map((a: any) => {
    const from = a.allotmentDate ? combineISTDateTime(a.allotmentDate, a.allotmentTime) : null;
    const days = !from ? 1
      : a.endDate
        ? computeBillingDays(from, combineISTDateTime(a.endDate, a.endTime))
        : computeBillingDays(from, openEndDate);
    return { label: `Bed — ${a.bedCategory} (${a.bedNo})`, amount: gstAmt(days * (a.charge || 0), a.gst, a.gstType) };
  }).filter((x: any) => x.amount > 0);
  const svcGstItems = entries
    .map((e: any) => ({ label: e.serviceName, amount: gstAmt(e.totalCharge, e.gst, e.gstType) }))
    .filter((x: any) => x.amount > 0);
  const invGstItems = investigations
    .flatMap((inv: any) => (inv.items || []).map((it: any) => ({ label: it.description, amount: gstAmt(it.netAmount || 0, it.gst, it.gstType) })))
    .filter((x: any) => x.amount > 0);
  const pharmGstItems = pharmBills
    .flatMap((b: any) => b.items.map((it: any) => ({ label: it.itemName, amount: gstAmt(it.netAmount, it.gst, it.gstType) })))
    .filter((x: any) => x.amount > 0);
  const gstBreakdown = [...bedGstItems, ...svcGstItems, ...invGstItems, ...pharmGstItems];
  const totalGst     = gstBreakdown.reduce((s, x) => s + x.amount, 0);

  const totalCharge  = bedTotal + servicesGross + invTotal + pharmTotal;
  const preDiscTotal = totalCharge - servicesDis;
  const billDiscAmt  = patient?.billDiscount != null
    ? (patient.billDiscountType === "percent" ? preDiscTotal * patient.billDiscount / 100 : patient.billDiscount)
    : 0;
  const grandTotal = preDiscTotal - billDiscAmt + totalGst;
  const due        = Math.max(0, grandTotal - totalReceived - totalTds - totalDisallowed);

  const isNonCash = !["CASH"].includes(form.receiptMode);

  const handleSubmit = async () => {
    if (!form.receiptAmount || Number(form.receiptAmount) <= 0)
      return toast.error("Enter a valid receipt amount");
    if (!form.receiptDate) return toast.error("Receipt date is required");
    const isEdit = !!editingId;
    if (!(await confirm({
      title: isEdit ? "Update receipt?" : "Save receipt?",
      description: isEdit
        ? "This will update the existing payment receipt for this patient."
        : "This will record a new payment receipt for this patient.",
      confirmText: isEdit ? "Yes, update" : "Yes, save",
    }))) return;
    setSaving(true);
    try {
      if (isEdit) {
        await ipdService.updateReceipt(editingId!, form);
        toast.success("Receipt updated");
      } else {
        await ipdService.createReceipt(id!, form);
        toast.success("Receipt saved");
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ ...BLANK });
      const rr = await ipdService.getReceipts(id!);
      setReceipts(rr.data.data.receipts || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save receipt");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r: ReceiptEntry) => {
    setEditingId(r._id);
    setForm({
      receiptDate:   r.receiptDate ? new Date(r.receiptDate).toISOString().slice(0, 10) : todayStr(),
      receiptAmount: r.receiptAmount || 0,
      receiptMode:   r.receiptMode || "CASH",
      remarks:       r.remarks || "",
      tds:           r.tds || 0,
      disallowed:    r.disallowed || 0,
      refund:        r.refund || 0,
      chequeNo:      r.chequeNo || "",
      chequeRefNo:   r.chequeRefNo || "",
      transactionId: r.transactionId || "",
      bank:          r.bank || "",
    });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...BLANK });
  };

  const handleDelete = async (receiptId: string) => {
    if (!(await confirm({
      title: "Delete receipt?",
      description: "This payment receipt will be permanently deleted.",
      confirmText: "Yes, delete",
      destructive: true,
    }))) return;
    try {
      await ipdService.deleteReceipt(receiptId);
      setReceipts(prev => prev.filter(r => r._id !== receiptId));
      if (editingId === receiptId) handleCancelForm();
      toast.success("Receipt deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  if (!patient) return <div className="flex items-center justify-center h-64 text-red-500">Patient not found</div>;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/ipd/edit/${id}`)} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Receipt From Patient</h1>
            <p className="text-gray-500 text-sm font-mono">{patient.admissionId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {receipts.length > 0 && (
            <Button
              variant="outline"
              className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              onClick={() => printAllReceipts(patient, receipts, {
                bedTotal:         bedTotal,
                servicesGross:    billSummary?.gross    ?? 0,
                servicesNet:      billSummary?.net      ?? 0,
                invTotal:         invTotal,
                pharmTotal:       pharmTotal,
                billDiscAmt,
                totalGst,
                gstBreakdown,
                discountSections,
                grandTotal,
              }, logoUrl)}
            >
              <Printer className="h-4 w-4" /> Print Money Receipt
            </Button>
          )}
          {!showForm && (
            <Button onClick={() => { setEditingId(null); setForm({ ...BLANK }); setShowForm(true); }} className="bg-green-600 hover:bg-green-700 gap-2">
              <Plus className="h-4 w-4" /> New Receipt
            </Button>
          )}
        </div>
      </div>

      {/* Patient info card */}
      <Card className="border-blue-100 bg-blue-50">
        <CardContent className="pt-3 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-gray-500 block">Patient</span>
              <span className="font-semibold">{patient.title} {patient.name}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Adm No</span>
              <span className="font-mono font-semibold">{patient.admissionId}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Adm Date</span>
              <span>{fmtDate(patient.admissionDate)}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Address</span>
              <span className="truncate block">{patient.address || "—"}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Attending Doctor(s)</span>
              <span>{patient.doctors?.map((d: any) => d.doctorName).join(", ") || "—"}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Contact No</span>
              <span>{patient.phone || "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-blue-100">
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-gray-500">Total Bill Amount</p>
            <p className="text-lg font-bold text-blue-700">{fmt(grandTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-green-100">
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-gray-500">Total Received</p>
            <p className="text-lg font-bold text-green-700">{fmt(totalReceived)}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-100">
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-gray-500">Refund</p>
            <p className="text-lg font-bold text-orange-600">{fmt(totalRefund)}</p>
          </CardContent>
        </Card>
        <Card className={`${due > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-gray-500">Due</p>
            <p className={`text-lg font-bold ${due > 0 ? "text-red-700" : "text-green-700"}`}>{fmt(due)}</p>
          </CardContent>
        </Card>
      </div>

      {/* New Receipt Form */}
      {showForm && (
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {editingId ? <Pencil className="h-4 w-4 text-green-600" /> : <Receipt className="h-4 w-4 text-green-600" />}
              {editingId ? "Edit Receipt" : "New Receipt"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Receipt Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.receiptDate}
                  onChange={e => set("receiptDate", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Amount (₹) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={form.receiptAmount || ""}
                  onChange={e => set("receiptAmount", Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Receipt Mode</Label>
                <Select value={form.receiptMode} onValueChange={v => set("receiptMode", v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECEIPT_MODES.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Remarks</Label>
                <Input
                  value={form.remarks}
                  onChange={e => set("remarks", e.target.value)}
                  placeholder="e.g. Bank name"
                  className="h-9 text-sm"
                />
              </div>

              {isNonCash && (
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Transaction / Reference ID</Label>
                  <Input
                    value={form.transactionId}
                    onChange={e => set("transactionId", e.target.value)}
                    placeholder={form.receiptMode === "UPI" ? "UPI transaction ID" : form.receiptMode === "NEFT" ? "NEFT reference no." : "Reference number"}
                    className="h-9 text-sm"
                  />
                </div>
              )}

              {isNonCash && (
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Bank</Label>
                  <Input
                    value={form.bank}
                    onChange={e => set("bank", e.target.value)}
                    placeholder="Bank name (optional)"
                    className="h-9 text-sm"
                  />
                </div>
              )}

              {(form.receiptMode === "CHEQUE" || form.receiptMode === "DD") && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Cheque No</Label>
                    <Input
                      value={form.chequeNo}
                      onChange={e => set("chequeNo", e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cheque Ref No</Label>
                    <Input
                      value={form.chequeRefNo}
                      onChange={e => set("chequeRefNo", e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <Label className="text-xs">TDS (₹)</Label>
                <Input
                  type="number"
                  value={form.tds || ""}
                  onChange={e => set("tds", Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Disallowed (₹)</Label>
                <Input
                  type="number"
                  value={form.disallowed || ""}
                  onChange={e => set("disallowed", Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Refund (₹)</Label>
                <Input
                  type="number"
                  value={form.refund || ""}
                  onChange={e => set("refund", Number(e.target.value))}
                  placeholder="0"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {form.receiptAmount > 0 && due > 0 && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                After this receipt: Due = {fmt(Math.max(0, due - Number(form.receiptAmount)))}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={handleCancelForm}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? "Saving…" : editingId ? "Update Receipt" : "Save Receipt"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Receipts */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Receipts</CardTitle>
            <span className="text-xs text-gray-500">Total Received: <span className="font-bold text-green-700">{fmt(totalReceived)}</span></span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {receipts.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No receipts recorded yet.</p>
              <p className="text-xs mt-1">Add a receipt to record partial or full payment.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-2 font-medium">Receipt No</th>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                  <th className="text-left px-4 py-2 font-medium">Mode</th>
                  <th className="text-left px-4 py-2 font-medium">Txn ID / Ref</th>
                  <th className="text-right px-4 py-2 font-medium">TDS</th>
                  <th className="text-right px-4 py-2 font-medium">Disallowed</th>
                  <th className="text-left px-4 py-2 font-medium">Remarks</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {receipts.map(r => (
                  <tr key={r._id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{r.receiptNo}</td>
                    <td className="px-4 py-2">{fmtDate(r.receiptDate)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-green-700">{fmt(r.receiptAmount)}</td>
                    <td className="px-4 py-2">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{r.receiptMode}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 font-mono max-w-32 truncate">
                      {r.transactionId || r.chequeNo || "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">{r.tds ? fmt(r.tds) : "—"}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{r.disallowed ? fmt(r.disallowed) : "—"}</td>
                    <td className="px-4 py-2 text-gray-500 max-w-32 truncate">{r.remarks || "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-400 hover:text-blue-600"
                          onClick={() => printReceipt(patient, r, totalReceived, logoUrl)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-amber-500 hover:text-amber-700"
                          onClick={() => handleEdit(r)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-600"
                          onClick={() => handleDelete(r._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Bill Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bill Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end">
            <div className="min-w-72 space-y-1.5 text-sm">
              {bedTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Bed Charge</span>
                  <span className="font-medium">{fmt(bedTotal)}</span>
                </div>
              )}
              {servicesGross > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Nursing Home Charges</span>
                  <span className="font-medium">{fmt(servicesGross)}</span>
                </div>
              )}
              {invTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Investigations</span>
                  <span className="font-medium">{fmt(invTotal)}</span>
                </div>
              )}
              {pharmTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Pharmacy</span>
                  <span className="font-medium">{fmt(pharmTotal)}</span>
                </div>
              )}
              {discountSections.map(sec => (
                <div key={sec.section} className="flex justify-between text-red-600">
                  <span>(-){sec.section} Discount</span>
                  <span className="font-medium">{fmt(sec.total)}</span>
                </div>
              ))}
              {billDiscAmt > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>(-) Bill Discount</span>
                  <span className="font-medium">{fmt(billDiscAmt)}</span>
                </div>
              )}
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
              <div className="flex justify-between border-t pt-1.5 mt-1">
                <span className="text-gray-600">Total Bill Amount</span>
                <span className="font-semibold">{fmt(grandTotal)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 mt-1">
                <span className="text-gray-600">Total Received</span>
                <span className="font-medium text-green-700">{fmt(totalReceived)}</span>
              </div>
              {totalTds > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">TDS</span>
                  <span className="font-medium">{fmt(totalTds)}</span>
                </div>
              )}
              {totalDisallowed > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Disallowed</span>
                  <span className="font-medium">{fmt(totalDisallowed)}</span>
                </div>
              )}
              {totalRefund > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Refund</span>
                  <span className="font-medium">{fmt(totalRefund)}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-gray-900 pt-2 mt-1">
                <span className="font-bold">Balance Due</span>
                <span className={`font-bold text-lg ${due > 0 ? "text-red-600" : "text-green-600"}`}>{fmt(due)}</span>
              </div>
              {due > 0 && (
                <div className="flex justify-between pt-1">
                  <span className="text-gray-600">Payable By Patient</span>
                  <span className="font-bold text-red-700">{fmt(due)}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Received highlight */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-3 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-green-800">Total Received Amount</span>
          </div>
          <span className="text-2xl font-bold text-green-700">{fmt(totalReceived)}</span>
        </CardContent>
      </Card>

      <ConfirmDialog />
    </div>
  );
}
