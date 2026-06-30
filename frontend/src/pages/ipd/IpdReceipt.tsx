import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Printer, Trash2, Receipt, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import ipdService, { RECEIPT_MODES, BED_CHARGES, computeBillingDays } from "@/services/ipdService";
import logoUrl from "@/assets/logo.png";

function todayStr() { return new Date().toISOString().slice(0, 10); }
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
  @media print{body{padding:12px}}
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
};

// ── Single receipt print ──────────────────────────────────────────────────────
function printReceipt(patient: any, receipt: ReceiptEntry, totalReceived: number, logo: string) {
  const now = new Date();
  const printDt = now.toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"})
    + " " + now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
  const payDetail = (() => {
    if (receipt.receiptMode === "CASH") return "";
    const parts: string[] = [];
    if (receipt.transactionId) parts.push(`Txn ID: ${receipt.transactionId}`);
    if (receipt.chequeNo)      parts.push(`Cheque No: ${receipt.chequeNo}`);
    if (receipt.chequeRefNo)   parts.push(`Ref: ${receipt.chequeRefNo}`);
    return parts.join(" | ");
  })();
  const w = window.open("", "_blank", "width=700,height=500");
  if (!w) { toast.error("Pop-up blocked — allow pop-ups"); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Receipt ${receipt.receiptNo}</title>
<style>${PRINT_CSS}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #374151;padding-bottom:10px;margin-bottom:14px}
  img{height:52px;object-fit:contain}
  .hosp{font-size:14px;font-weight:bold;color:#b91c1c}.sub{font-size:10px;color:#6b7280;margin-top:2px}
  h2{font-size:18px;font-weight:bold;color:#b91c1c;text-align:right}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 32px;border-bottom:1px solid #e5e7eb;padding-bottom:10px;margin-bottom:12px}
  .il{font-size:10px;color:#6b7280}.iv{font-weight:600;font-size:12px}
  .total-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-top:10px}
  .total-label{font-size:13px;font-weight:bold;color:#1d4ed8}.total-amt{font-size:22px;font-weight:bold;color:#1e40af}
</style></head><body>
<div class="header">
  <div style="display:flex;align-items:center;gap:12px">
    <img src="${logo}" alt="Logo"/>
    <div><div class="hosp">AROGYA MATERNITY &amp; NURSING HOME</div>
    <div class="sub">(A Unit of R.P. Medical Foundation Pvt. Ltd.)</div>
    <div class="sub">71, Tollygunge Circular Road, Kolkata-700053</div></div>
  </div>
  <h2>RECEIPT</h2>
</div>
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
  <thead><tr><th>Receipt No</th><th>Date</th><th>Mode</th><th>Reference / Txn ID</th><th>Remarks</th><th class="right">Amount</th></tr></thead>
  <tbody>
    <tr>
      <td style="font-family:monospace">${receipt.receiptNo}</td>
      <td>${fmtDate(receipt.receiptDate)}</td>
      <td>${receipt.receiptMode}</td>
      <td>${payDetail || "—"}</td>
      <td>${receipt.remarks || "—"}</td>
      <td class="right" style="font-weight:bold">${fmtAmt(receipt.receiptAmount)}</td>
    </tr>
  </tbody>
</table>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:10px">
  <div>
    ${receipt.tds ? `<div style="font-size:11px">TDS: ${fmt(receipt.tds)}</div>` : ""}
    ${receipt.disallowed ? `<div style="font-size:11px">Disallowed: ${fmt(receipt.disallowed)}</div>` : ""}
  </div>
  <div>
    <div style="font-size:11px;display:flex;justify-content:space-between"><span>This Receipt</span><span>${fmt(receipt.receiptAmount)}</span></div>
    <div style="font-size:11px;display:flex;justify-content:space-between"><span>Total Received</span><span style="font-weight:bold">${fmt(totalReceived)}</span></div>
  </div>
</div>
<div class="total-box">
  <div class="total-label">Amount Received</div>
  <div class="total-amt">${fmt(receipt.receiptAmount)}</div>
</div>
<div class="words-box" style="margin-top:10px">(Amount Received : Rupees ${toWords(receipt.receiptAmount)} Only)</div>
<div class="footer"><span>Print Date : ${printDt}</span></div>
<div class="sig">
  <div><div class="sig-line">Patient / Guardian</div></div>
  <div style="text-align:right"><div style="font-size:11px;margin-bottom:20px">E &amp; O.E.</div><div class="sig-line" style="margin-left:auto">Authorised Signatory</div></div>
</div>
<script>window.onload=function(){window.focus();window.print();setTimeout(()=>window.close(),500)}<\/script>
</body></html>`);
  w.document.close();
}

interface ChargeData {
  bedTotal: number;
  servicesGross: number;
  servicesDiscount: number;
  servicesNet: number;
  invTotal: number;
  pharmTotal: number;
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
  const grandTotal    = charges.bedTotal + charges.servicesNet + charges.invTotal + charges.pharmTotal;
  const netDue        = Math.max(0, grandTotal - totalReceived - totalTds - totalDis);

  const now = new Date();
  const printDt = now.toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"})
    + " " + now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
  const admDt     = patient.admissionDate ? fmtDateShort(patient.admissionDate) : "—";
  const invoiceDt = now.toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"});
  const invoiceTm = now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:false});
  const ageStr = [
    patient.ageYears  ? patient.ageYears  + " Year"  : "",
    patient.ageMonths ? patient.ageMonths + " Month" : "",
    patient.ageDays   ? patient.ageDays   + " Day"   : "",
  ].filter(Boolean).join(" ") || "—";

  const chargeRows = [
    charges.bedTotal > 0
      ? `<tr><td>Bed Charges</td><td class="right">${fmtAmt(charges.bedTotal)}</td></tr>` : "",
    charges.servicesGross > 0
      ? `<tr><td>Nursing Home Charges</td><td class="right">${fmtAmt(charges.servicesGross)}</td></tr>` : "",
    charges.servicesDiscount > 0
      ? `<tr><td style="color:#c00">(-) Discount</td><td class="right" style="color:#c00">(${fmtAmt(charges.servicesDiscount)})</td></tr>` : "",
    charges.invTotal > 0
      ? `<tr><td>Investigations</td><td class="right">${fmtAmt(charges.invTotal)}</td></tr>` : "",
    charges.pharmTotal > 0
      ? `<tr><td>Pharmacy</td><td class="right">${fmtAmt(charges.pharmTotal)}</td></tr>` : "",
    `<tr style="font-weight:bold;background:#f3f4f6"><td>Total Bill Amount</td><td class="right">${fmtAmt(grandTotal)}</td></tr>`,
  ].filter(Boolean).join("");

  const paymentRows = receipts.map(r => {
    const line1 = `${fmtDateShort(r.receiptDate)}, Received: ${fmtAmt(r.receiptAmount)}, ${r.receiptMode}${r.remarks ? ", " + r.remarks : ""}`;
    const ref = r.transactionId || r.chequeNo
      ? `(${[r.transactionId, r.chequeNo ? "Cheque: "+r.chequeNo : "", r.chequeRefNo].filter(Boolean).join(" | ")})`
      : "";
    return `<tr>
      <td>${line1}${ref ? `<br/><span style="color:#555">${ref}</span>` : ""}</td>
      <td class="right"></td>
    </tr>`;
  }).join("");

  const w = window.open("", "_blank", "width=780,height=620");
  if (!w) { toast.error("Pop-up blocked — allow pop-ups"); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Money Receipt — ${patient.admissionId}</title>
<style>${PRINT_CSS}</style></head><body>
<div style="text-align:center;margin-bottom:8px">
  <img src="${logo}" alt="Logo" style="height:56px;object-fit:contain"/>
  <div style="font-size:15px;font-weight:bold;color:#b91c1c;margin-top:4px">AROGYA MATERNITY &amp; NURSING HOME</div>
  <div style="font-size:10px;color:#6b7280">(A Unit of R.P. Medical Foundation Pvt. Ltd.) &nbsp;|&nbsp; 71, Tollygunge Circular Road, Kolkata-700053</div>
</div>
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
</div>
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
    <tr style="font-weight:bold;background:#fff7ed">
      <td>${netDue > 0 ? "Balance Due" : "Overpaid / Advance"}</td>
      <td class="right" style="color:${netDue > 0 ? "#b91c1c" : "#15803d"}">${fmtAmt(netDue)}</td>
    </tr>
  </tbody>
</table>
<div class="words-box">(Amount Received : Rupees ${toWords(totalReceived)} Only)</div>
<div class="footer">
  <span>Print Date : ${printDt}</span>
  <span>E &amp; O.E.</span>
</div>
<div class="sig">
  <div><div class="sig-line">Patient / Guardian</div></div>
  <div><div class="sig-line">Signature</div></div>
</div>
<script>window.onload=function(){window.focus();window.print();setTimeout(()=>window.close(),500)}<\/script>
</body></html>`);
  w.document.close();
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function IpdReceipt() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();

  const [patient,       setPatient]       = useState<any>(null);
  const [receipts,      setReceipts]      = useState<ReceiptEntry[]>([]);
  const [billSummary,   setBillSummary]   = useState<{ gross: number; discount: number; net: number; count: number } | null>(null);
  const [bedAllotments, setBedAllotments] = useState<any[]>([]);
  const [invTotal,      setInvTotal]      = useState(0);
  const [pharmTotal,    setPharmTotal]    = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [showForm,      setShowForm]      = useState(false);
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
      ipdService.getBedAllotments(id),
      ipdService.getInvestigations(id),
      ipdService.getPharmacyTotal(id),
    ]).then(([pr, rr, br, asr, invR, phR]) => {
      setPatient(pr.data.data);
      setReceipts(rr.data.data.receipts || []);
      setBillSummary(br.data.data);
      setBedAllotments(asr.data.data.allotments || []);
      const investigations: any[] = invR.data.data.investigations || [];
      setInvTotal(investigations.reduce((s: number, i: any) => s + (i.totalAmount || 0), 0));
      setPharmTotal(phR.data.data?.total ?? 0);
    }).catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }));

  const totalReceived   = receipts.reduce((s, r) => s + (r.receiptAmount || 0), 0);
  const totalTds        = receipts.reduce((s, r) => s + (r.tds        || 0), 0);
  const totalDisallowed = receipts.reduce((s, r) => s + (r.disallowed || 0), 0);
  const totalRefund     = receipts.reduce((s, r) => s + (r.refund     || 0), 0);
  const servicesNet     = billSummary?.net      ?? 0;
  const servicesGross   = billSummary?.gross    ?? 0;
  const servicesDis     = billSummary?.discount ?? 0;

  const openEndDate = patient?.dischargeDate
    ? new Date(patient.dischargeDate)
    : patient?.estimateEndDate
      ? new Date(patient.estimateEndDate)
      : liveNow;

  const computedBedTotal = bedAllotments.length > 0
    ? bedAllotments.reduce((s: number, a: any) => {
        const days = a.endDate && a.allotmentDate
          ? computeBillingDays(new Date(a.allotmentDate), new Date(a.endDate))
          : (a.allotmentDate
              ? computeBillingDays(new Date(a.allotmentDate), openEndDate)
              : 1);
        return s + days * (a.charge || 0);
      }, 0)
    : (() => {
        const rate = patient?.bedCategory ? (BED_CHARGES[patient.bedCategory as string] ?? 0) : 0;
        const days = patient?.admissionDate
          ? computeBillingDays(new Date(patient.admissionDate), openEndDate)
          : 1;
        return rate * days;
      })();

  const bedTotal   = patient?.bedChargeOverride != null ? patient.bedChargeOverride : computedBedTotal;
  const grandTotal = bedTotal + servicesNet + invTotal + pharmTotal;
  const due        = Math.max(0, grandTotal - totalReceived - totalTds - totalDisallowed);

  const isNonCash = !["CASH"].includes(form.receiptMode);

  const handleSubmit = async () => {
    if (!form.receiptAmount || Number(form.receiptAmount) <= 0)
      return toast.error("Enter a valid receipt amount");
    if (!form.receiptDate) return toast.error("Receipt date is required");
    if (!(await confirm({ title: "Save receipt?", description: "This will record a new payment receipt for this patient.", confirmText: "Yes, save" }))) return;
    setSaving(true);
    try {
      await ipdService.createReceipt(id!, form);
      toast.success("Receipt saved");
      setShowForm(false);
      setForm({ ...BLANK });
      const rr = await ipdService.getReceipts(id!);
      setReceipts(rr.data.data.receipts || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save receipt");
    } finally {
      setSaving(false);
    }
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
                servicesDiscount: billSummary?.discount ?? 0,
                servicesNet:      billSummary?.net      ?? 0,
                invTotal:         invTotal,
                pharmTotal:       pharmTotal,
              }, logoUrl)}
            >
              <Printer className="h-4 w-4" /> Print Money Receipt
            </Button>
          )}
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700 gap-2">
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
              <Receipt className="h-4 w-4 text-green-600" /> New Receipt
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
              <Button variant="outline" onClick={() => { setShowForm(false); setForm({ ...BLANK }); }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? "Saving…" : "Save Receipt"}
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
              {servicesDis > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>(-)Less Discount</span>
                  <span className="font-medium">{fmt(servicesDis)}</span>
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
