import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, IndianRupee, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import ipdService, { DISCHARGE_TYPES, BED_CHARGES, computeBillingDays } from "@/services/ipdService";
import logoUrl from "@/assets/logo.png";

function todayStr() {
  const n = new Date();
  return new Date(n.getTime() + 330 * 60000).toISOString().slice(0, 10); // IST date
}
function toISTDateStr(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Date(dt.getTime() + 330 * 60000).toISOString().slice(0, 10);
}
function nowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}
function fmtRs(n: number) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
function fmtDateLong(d: string | Date | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Section textarea component ─────────────────────────────────────────────────
function SectionArea({
  label, value, onChange, rows = 4, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  rows?: number; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</Label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full border rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-red-400"
      />
    </div>
  );
}

// ── Print discharge certificate (matches PDF exactly) ─────────────────────────
function printDischargeCertificate(patient: any, form: any, logo: string, medicines: string[] = []) {
  const w = window.open("", "_blank", "width=900,height=750");
  if (!w) { toast.error("Pop-up blocked — allow pop-ups and try again"); return; }

  const admDate = patient.admissionDate
    ? fmtDateLong(patient.admissionDate)
    : "—";
  const disDate = form.dischargeDate
    ? fmtDateLong(form.dischargeDate)
    : "—";
  const admTime   = patient.admissionTime || "";
  const disTime   = form.dischargeTime   || "";
  const doctor    = patient.doctors?.length
    ? patient.doctors.map((d: any) => d.doctorName).join(", ")
    : "—";
  const bedInfo   = `${patient.bedNo || "—"} ${patient.bedCategory ? `(${patient.bedCategory})` : ""}`;
  const age       = patient.ageYears ? `${patient.ageYears} Year` : "—";
  const sexAge    = `${patient.gender || "—"} / ${age}`;
  const now       = new Date();
  const printDate = now.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0")
    + ":" + String(now.getSeconds()).padStart(2,"0");

  function section(title: string, content: string) {
    if (!content?.trim()) return "";
    return `
      <p class="sec-title">${title}</p>
      <div class="sec-body">${content.replace(/\n/g, "<br/>")}</div>`;
  }

  w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>Discharge Certificate — ${patient.admissionId}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11.5px;color:#000;padding:20px 24px}
  .page-header{display:flex;align-items:stretch;border:1.5px solid #000;margin-bottom:14px}
  .logo-cell{padding:8px 12px;display:flex;align-items:center;border-right:1.5px solid #000;min-width:90px}
  .logo-cell img{width:75px;height:75px;object-fit:contain}
  .hospital-cell{flex:1;text-align:center;padding:8px 12px;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .h-name{font-size:17px;font-weight:bold;letter-spacing:0.02em}
  .h-sub{font-size:11px;margin-top:1px}
  .h-reg{font-size:11px;font-weight:bold;margin-top:3px}
  .h-addr{font-size:11px;margin-top:1px}
  .h-phone{font-size:11px;margin-top:1px}
  .cert-title{text-align:center;font-size:14px;font-weight:bold;text-decoration:underline;margin:10px 0 12px}
  .info-table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11.5px}
  .info-table td{padding:2px 4px;vertical-align:top}
  .lbl{font-weight:normal;color:#000;white-space:nowrap;width:120px}
  .col{width:16px;text-align:center}
  .val{font-weight:normal}
  .disc-title{text-align:center;font-size:13px;font-weight:bold;text-decoration:underline;margin:14px 0 10px}
  .sec-title{font-weight:bold;text-decoration:underline;margin:10px 0 2px;font-size:11.5px}
  .sec-body{font-size:11.5px;margin-bottom:2px;line-height:1.5}
  .footer{margin-top:36px}
  .sig-row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px}
  .sig-left{width:55%}
  .sig-right{width:40%;text-align:center}
  .sig-line{border-top:1px solid #000;padding-top:4px;font-size:11px;margin-top:30px}
  .sig-label{font-size:11px;font-weight:bold;text-align:center}
  .reg-line{font-size:11px;margin-top:2px}
  .checkbox-row{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px}
  .checkbox{width:12px;height:12px;border:1px solid #000;display:inline-block;margin-right:4px}
  .checked-by{margin-top:20px;font-size:11px}
  .print-date{text-align:left;font-size:10px;color:#333;margin-top:10px}
  @media print{body{padding:10px 14px}}
</style>
</head><body>

<div class="page-header">
  <div class="logo-cell"><img src="${logo}" alt="Logo"/></div>
  <div class="hospital-cell">
    <div class="h-name">AROGYA MATERNITY &amp; NURSING HOME</div>
    <div class="h-sub">(A Unit of R.P. Medical Foundation Pvt. Ltd.)</div>
    <div class="h-sub">(Licence Under W.B.Clinical Establishment Act)</div>
    <div class="h-reg">Regd.No:- 34235649</div>
    <div class="h-addr">71,TOLLYGUNGE CIRCULAR ROAD, KOLKATA-700053</div>
    <div class="h-addr">(NEW ALIPORE, SITAL SADAN COMPOUND)</div>
    <div class="h-phone">Phone:- (033) 2400-0681 / 0684&nbsp;&nbsp;&nbsp;Fax No:- (033) 2400-1180</div>
  </div>
</div>

<div class="cert-title">DISCHARGE CERTIFICATE</div>

<table class="info-table">
  <tr>
    <td class="lbl">Patient Id</td><td class="col">:</td>
    <td class="val">${patient.ipdRegistrationNo || patient.admissionId}</td>
    <td width="40"></td>
    <td class="lbl">Bed No.</td><td class="col">:</td>
    <td class="val">${bedInfo}</td>
  </tr>
  <tr>
    <td class="lbl">Admission No</td><td class="col">:</td>
    <td class="val">${patient.admissionId}</td>
    <td></td>
    <td class="lbl">Admission Dt.</td><td class="col">:</td>
    <td class="val">${admDate}&nbsp;&nbsp;${admTime}</td>
  </tr>
  <tr>
    <td class="lbl">Admitting Doctor</td><td class="col">:</td>
    <td class="val">${doctor}</td>
    <td></td>
    <td class="lbl">Discharge Dt.</td><td class="col">:</td>
    <td class="val">${disDate}&nbsp;&nbsp;${disTime}</td>
  </tr>
  <tr>
    <td class="lbl">Patient Name</td><td class="col">:</td>
    <td class="val">${patient.title} ${patient.name}</td>
    <td></td>
    <td class="lbl">Discharge Type</td><td class="col">:</td>
    <td class="val"><strong>${form.dischargeType || "—"}</strong></td>
  </tr>
  <tr>
    <td class="lbl">Sex / Age</td><td class="col">:</td>
    <td class="val">${sexAge}</td>
    <td></td><td></td><td></td><td></td>
  </tr>
  <tr>
    <td class="lbl">Address</td><td class="col">:</td>
    <td class="val" colspan="4">${patient.address || "—"}</td>
  </tr>
</table>

<div class="disc-title">DISCHARGE SUMMARY</div>

${section("DISCHARGE DIAGNOSIS:-", form.dischargeDiagnosis)}
${section("CHIEF COMPLAIN :-", form.chiefComplaint)}
${section("ON EXAMINATION :-", form.onExamination)}
${section("PAST HISTORY:-", form.pastHistory)}
${section("INVESTIGATIONS:-", form.investigationSummary)}
${section("TREATMENT / OPERATION (DETAILS) :-", form.treatmentDetails)}
${section("DISCHARGE STATUS AND ADVICE :-", form.adviceOnDischarge)}
${medicines.length > 0 ? `<p class="sec-title">MEDICINES DISPENSED :-</p><div class="sec-body">${medicines.join(", ")}</div>` : ""}

<div class="footer">
  <div class="sig-row">
    <div class="sig-left">
      <div class="sig-line">SIGNATURE OF MEDICAL OFFICER</div>
      <div class="reg-line">REGISTRATION NO :</div>
      <div class="checkbox-row"><span class="checkbox"></span>All Investigation Report/s received.</div>
      <div class="checkbox-row"><span class="checkbox"></span>Original Copy of discharge summary received</div>
      <div class="checkbox-row"><span class="checkbox"></span>Advices are explained to me in my language.</div>
      <div class="checked-by">Checked By :.............................................................. ${doctor}</div>
      <div style="font-size:11px;margin-top:4px">Date : ${disDate}</div>
    </div>
    <div class="sig-right">
      <div class="sig-line">SIGNATURE OF TREATING DOCTOR</div>
      <div class="sig-label">${doctor}</div>
    </div>
  </div>
  <div class="print-date">Print Date : ${printDate}</div>
</div>

<script>window.onload=function(){window.focus();window.print();setTimeout(()=>window.close(),500)}<\/script>
</body></html>`);
  w.document.close();
}

export default function IpdDischarge() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient,        setPatient]        = useState<any>(null);
  const [billingSummary, setBillingSummary]  = useState<{ gross: number; discount: number; net: number; count: number } | null>(null);
  const [bedAllotments,  setBedAllotments]  = useState<any[]>([]);
  const [invTotal,       setInvTotal]       = useState(0);
  const [pharmTotal,     setPharmTotal]     = useState(0);
  const [pharmMedicines, setPharmMedicines] = useState<string[]>([]);
  const [loading,        setLoading]         = useState(true);
  const [saving,         setSaving]          = useState(false);

  const [form, setForm] = useState({
    dischargeDate:      todayStr(),
    dischargeTime:      nowTimeStr(),
    dischargeType:      "",
    referredTo:         "",
    dischargeDiagnosis: "",
    chiefComplaint:     "",
    onExamination:      "",
    pastHistory:        "",
    investigationSummary: "",
    treatmentDetails:   "",
    adviceOnDischarge:  "",
  });

  const setF = (field: string, val: string) =>
    setForm(f => ({ ...f, [field]: val }));

  useEffect(() => {
    if (!id) return;
    Promise.all([
      ipdService.getPatient(id),
      ipdService.getBillingSummary(id),
      ipdService.getBedAllotments(id),
      ipdService.getInvestigations(id),
      ipdService.getPharmacyBills(id),
    ]).then(([pr, br, asr, invR, phR]) => {
      const p = pr.data.data;
      setPatient(p);
      setBillingSummary(br.data.data);
      setBedAllotments(asr.data.data.allotments || []);
      const investigations: any[] = invR.data.data.investigations || [];
      setInvTotal(investigations.reduce((s: number, i: any) => s + (i.totalAmount || 0), 0));
      const pharmBills: any[] = phR.data.data.bills || [];
      setPharmTotal(pharmBills.reduce((s: number, b: any) => s + (b.netAmount || 0), 0));
      const allMeds = pharmBills.flatMap((b: any) => (b.items || []).map((it: any) => it.itemName as string));
      setPharmMedicines([...new Set(allMeds.filter(Boolean))]);
      setForm(f => ({
        ...f,
        dischargeDate:        p.dischargeDate ? toISTDateStr(p.dischargeDate) : f.dischargeDate,
        dischargeTime:        p.dischargeTime        || f.dischargeTime,
        dischargeType:        p.dischargeType        || f.dischargeType,
        referredTo:           p.referredTo           || "",
        dischargeDiagnosis:   p.dischargeDiagnosis   || "",
        chiefComplaint:       p.chiefComplaint       || "",
        onExamination:        p.onExamination        || "",
        pastHistory:          p.pastHistory          || "",
        investigationSummary: p.investigationSummary || "",
        treatmentDetails:     p.treatmentDetails     || "",
        adviceOnDischarge:    p.adviceOnDischarge    || "",
      }));
    }).catch(() => toast.error("Failed to load patient"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (markDischarged = false) => {
    if (!form.dischargeDate) return toast.error("Discharge date is required");
    if (!form.dischargeType) return toast.error("Discharge type is required");
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (markDischarged) payload.status = "Discharged";
      await ipdService.updatePatient(id!, payload);
      toast.success(markDischarged ? "Patient discharged successfully" : "Discharge note saved");
      if (markDischarged) navigate("/ipd/search");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  if (!patient) return <div className="flex items-center justify-center h-64 text-red-500">Patient not found</div>;

  const dischargeEndDate = form.dischargeDate
    ? new Date(`${form.dischargeDate}T${form.dischargeTime || "00:00"}`)
    : undefined;

  const billingDays = patient.admissionDate
    ? computeBillingDays(new Date(patient.admissionDate), dischargeEndDate)
    : 1;

  const admDays = patient.admissionDate
    ? Math.floor((Date.now() - new Date(patient.admissionDate).getTime()) / 86400000)
    : 0;

  const openFallback = dischargeEndDate
    ?? (patient.estimateEndDate ? new Date(patient.estimateEndDate) : new Date());

  const computedBedTotal = bedAllotments.length > 0
    ? bedAllotments.reduce((s: number, a: any) => {
        const days = a.endDate && a.allotmentDate
          ? computeBillingDays(new Date(a.allotmentDate), new Date(a.endDate))
          : computeBillingDays(new Date(a.allotmentDate), openFallback);
        return s + days * (a.charge || 0);
      }, 0)
    : (() => {
        const rate = patient.bedCategory ? (BED_CHARGES[patient.bedCategory as string] ?? 0) : 0;
        const end = patient.dischargeDate ? new Date(patient.dischargeDate) : openFallback;
        const days = patient.admissionDate && end
          ? computeBillingDays(new Date(patient.admissionDate), end)
          : billingDays;
        return rate * days;
      })();

  const bedTotal    = patient.bedChargeOverride != null ? patient.bedChargeOverride : computedBedTotal;
  const servicesNet = billingSummary?.net ?? 0;
  const grandTotal  = bedTotal + servicesNet + invTotal + pharmTotal;

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/ipd/edit/${id}`)} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Patient Discharge</h1>
            <p className="text-gray-500 text-sm font-mono">{patient.admissionId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/ipd/billing/${id}`)} className="gap-1.5">
            <IndianRupee className="h-4 w-4" /> View Bill
          </Button>
          <Button
            variant="outline"
            onClick={() => printDischargeCertificate(patient, form, logoUrl, pharmMedicines)}
            className="gap-2"
          >
            <Printer className="h-4 w-4" /> Print Discharge Certificate
          </Button>
        </div>
      </div>

      {/* Patient summary */}
      <Card className="border-blue-100 bg-blue-50">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-gray-500 block">Patient Name</span>
              <span className="font-semibold">{patient.title} {patient.name}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Sex / Age</span>
              <span>{patient.gender} / {patient.ageYears} Yrs</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Admission Date</span>
              <span>{patient.admissionDate ? new Date(patient.admissionDate).toLocaleDateString("en-IN") : "—"}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Days Admitted</span>
              <span className="font-semibold">{admDays} day{admDays !== 1 ? "s" : ""}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Bed</span>
              <span>{patient.bedNo || "—"} {patient.bedCategory ? `(${patient.bedCategory})` : ""}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Attending Doctor(s)</span>
              <span>{patient.doctors?.map((d: any) => d.doctorName).join(", ") || "—"}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Contact</span>
              <span>{patient.phone}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Current Status</span>
              <span className={`font-semibold ${patient.status === "Admitted" ? "text-green-600" : "text-gray-500"}`}>
                {patient.status}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing days + charge summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-indigo-100">
          <CardContent className="pt-3 pb-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CalendarDays className="h-4 w-4 text-indigo-500" />
              <p className="text-xs text-gray-500">Billing Days</p>
            </div>
            <p className="text-lg font-bold text-indigo-700">{billingDays}</p>
            <p className="text-[10px] text-gray-400">12 AM – 11:59 PM cycle</p>
          </CardContent>
        </Card>
        <Card className="border-blue-100">
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-gray-500">Bed Charges</p>
            <p className="text-lg font-bold text-blue-700">{fmtRs(bedTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-purple-100">
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-gray-500">Services</p>
            <p className="text-lg font-bold text-purple-700">{fmtRs(servicesNet)}</p>
            {billingSummary && billingSummary.discount > 0 && (
              <p className="text-[10px] text-red-500">-{fmtRs(billingSummary.discount)} disc.</p>
            )}
          </CardContent>
        </Card>
        {invTotal > 0 && (
          <Card className="border-orange-100">
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-xs text-gray-500">Investigations</p>
              <p className="text-lg font-bold text-orange-600">{fmtRs(invTotal)}</p>
            </CardContent>
          </Card>
        )}
        {pharmTotal > 0 && (
          <Card className="border-green-100">
            <CardContent className="pt-3 pb-3 text-center">
              <p className="text-xs text-gray-500">Pharmacy</p>
              <p className="text-lg font-bold text-green-600">{fmtRs(pharmTotal)}</p>
            </CardContent>
          </Card>
        )}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-gray-500">Grand Total</p>
            <p className="text-xl font-bold text-green-700">{fmtRs(grandTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Discharge details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Discharge Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Discharge Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={form.dischargeDate}
                onChange={e => setF("dischargeDate", e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Discharge Time</Label>
              <Input
                type="time"
                value={form.dischargeTime}
                onChange={e => setF("dischargeTime", e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Discharge Type <span className="text-red-500">*</span></Label>
              <Select
                value={form.dischargeType || "none"}
                onValueChange={v => setF("dischargeType", v === "none" ? "" : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="-- Select --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select --</SelectItem>
                  {DISCHARGE_TYPES.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Referred To</Label>
              <Input
                value={form.referredTo}
                onChange={e => setF("referredTo", e.target.value)}
                className="h-9 text-sm"
                placeholder="Hospital / doctor"
              />
            </div>
          </div>
          <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mt-3">
            Billing days increment at midnight (12 AM IST). Discharge before midnight to avoid the next day's bed charge.
          </p>
        </CardContent>
      </Card>

      {/* Discharge Summary sections */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Discharge Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SectionArea
            label="Discharge Diagnosis"
            value={form.dischargeDiagnosis}
            onChange={v => setF("dischargeDiagnosis", v)}
            rows={3}
            placeholder="e.g. Acute Calculus Cholecystitis with Gall Bladder Lump&#10;T2DM&#10;HTN"
          />
          <SectionArea
            label="Chief Complaint"
            value={form.chiefComplaint}
            onChange={v => setF("chiefComplaint", v)}
            rows={2}
            placeholder="e.g. Pain in the right hypochondrium region since last few days."
          />
          <SectionArea
            label="On Examination"
            value={form.onExamination}
            onChange={v => setF("onExamination", v)}
            rows={4}
            placeholder="e.g. BP- 130/80 mm of hg&#10;Pulse- 80/min&#10;Spo2- 97% in R/A&#10;Afebrile"
          />
          <SectionArea
            label="Past History"
            value={form.pastHistory}
            onChange={v => setF("pastHistory", v)}
            rows={3}
            placeholder="e.g. F/U/C/O- Acute Calculus Cholecystitis&#10;T2DM&#10;HTN"
          />
          <SectionArea
            label="Investigations"
            value={form.investigationSummary}
            onChange={v => setF("investigationSummary", v)}
            rows={3}
            placeholder="e.g. BLOOD :- All reports are enclosed&#10;USG:- W/A report attached"
          />
          <SectionArea
            label="Treatment / Operation (Details)"
            value={form.treatmentDetails}
            onChange={v => setF("treatmentDetails", v)}
            rows={4}
            placeholder="e.g. Patient treated conservatively with IVF, Inj. Meropenem iv..."
          />
        </CardContent>
      </Card>

      {/* Medicines from Pharmacy */}
      {pharmMedicines.length > 0 && (
        <Card className="border-green-100 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-800">Medicines Dispensed (from Pharmacy)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pharmMedicines.map(m => (
                <span key={m} className="text-xs bg-white border border-green-200 text-green-800 rounded px-2 py-1 font-medium">
                  {m}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">These will appear in the discharge certificate.</p>
          </CardContent>
        </Card>
      )}

      {/* Discharge Advice */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Discharge Status and Advice</CardTitle>
        </CardHeader>
        <CardContent>
          <SectionArea
            label=""
            value={form.adviceOnDischarge}
            onChange={v => setF("adviceOnDischarge", v)}
            rows={8}
            placeholder="e.g. Rest at home.&#10;Diabetic soft bland diet.&#10;Cap. Pan - D 1 cap before breakfast (7 am) for 1 month.&#10;Tab. ..."
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-6">
        <Button variant="outline" onClick={() => navigate(`/ipd/edit/${id}`)}>
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSave(false)}
          disabled={saving}
          className="border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          {saving ? "Saving…" : "Save Note"}
        </Button>
        <Button
          onClick={() => handleSave(true)}
          disabled={saving || patient.status === "Discharged"}
          className="bg-red-600 hover:bg-red-700 px-6"
        >
          {saving
            ? "Processing…"
            : patient.status === "Discharged"
            ? "Already Discharged"
            : "Discharge Patient"}
        </Button>
      </div>
    </div>
  );
}
