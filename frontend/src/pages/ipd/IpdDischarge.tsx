import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, IndianRupee, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import ipdService, { DISCHARGE_TYPES, computeBillingDays } from "@/services/ipdService";
import logoUrl from "@/assets/logo.png";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}
function fmtRs(n: number) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

export default function IpdDischarge() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient,          setPatient]          = useState<any>(null);
  const [billingSummary,   setBillingSummary]    = useState<{ gross: number; discount: number; net: number; count: number } | null>(null);
  const [loading,          setLoading]           = useState(true);
  const [saving,           setSaving]            = useState(false);

  // Discharge form
  const [dischargeDate,     setDischargeDate]     = useState(todayStr());
  const [dischargeTime,     setDischargeTime]     = useState(nowTimeStr());
  const [dischargeType,     setDischargeType]     = useState("");
  const [referredTo,        setReferredTo]        = useState("");
  const [dischargeNote,     setDischargeNote]     = useState("");
  const [adviceOnDischarge, setAdviceOnDischarge] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      ipdService.getPatient(id),
      ipdService.getBillingSummary(id),
    ]).then(([pr, br]) => {
      const p = pr.data.data;
      setPatient(p);
      setBillingSummary(br.data.data);
      if (p.dischargeDate) setDischargeDate(new Date(p.dischargeDate).toISOString().slice(0, 10));
      if (p.dischargeTime)     setDischargeTime(p.dischargeTime);
      if (p.dischargeType)     setDischargeType(p.dischargeType);
      if (p.referredTo)        setReferredTo(p.referredTo);
      if (p.dischargeNote)     setDischargeNote(p.dischargeNote);
      if (p.adviceOnDischarge) setAdviceOnDischarge(p.adviceOnDischarge);
    }).catch(() => toast.error("Failed to load patient"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (markDischarged = false) => {
    if (!dischargeDate) return toast.error("Discharge date is required");
    if (!dischargeType) return toast.error("Discharge type is required");
    setSaving(true);
    try {
      const payload: any = {
        dischargeDate, dischargeTime, dischargeType,
        referredTo, dischargeNote, adviceOnDischarge,
      };
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

  const printDischargeNote = () => {
    if (!patient) return;
    const billingDays = patient.admissionDate
      ? computeBillingDays(new Date(patient.admissionDate))
      : "—";

    const win = window.open("", "_blank", "width=800,height=700");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
    <title>Discharge Note — ${patient.admissionId}</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;margin:24px;font-size:13px;color:#222}
      .header{display:flex;align-items:center;border-bottom:2px solid #800000;padding-bottom:10px;margin-bottom:20px}
      .logo{width:70px;height:70px;margin-right:14px;object-fit:contain}
      .hospital-name{color:#800000;font-size:20px;font-weight:bold}
      .sub{font-size:11px;color:#555;margin:2px 0}
      h2{text-align:center;font-size:15px;text-decoration:underline;margin:16px 0}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      td{padding:5px 8px}
      .label{font-weight:600;color:#555;width:160px}
      .section{font-weight:700;font-size:13px;border-bottom:1px solid #ccc;margin:16px 0 8px;padding-bottom:4px}
      .note-box{border:1px solid #ccc;border-radius:4px;padding:12px;min-height:100px;background:#fafafa;white-space:pre-wrap}
      .bill-summary{border:1px solid #ccc;border-radius:4px;padding:10px;background:#f9fafb}
      .bill-row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
      .net{font-weight:700;border-top:1px solid #ccc;margin-top:4px;padding-top:4px}
      @media print{button{display:none}}
    </style></head><body>
    <div class="header">
      <img class="logo" src="${window.location.origin}${logoUrl}" />
      <div>
        <div class="hospital-name">AROGYA MATERNITY &amp; NURSING HOME</div>
        <div class="sub">(A Unit of R.P. Medical Foundation Pvt. Ltd.)</div>
        <div class="sub">71, Tollygunge Circular Road, Kolkata-700053 | Ph: (033) 2400-0681</div>
      </div>
    </div>
    <h2>PATIENT DISCHARGE NOTE</h2>
    <table>
      <tr>
        <td class="label">Admission No:</td><td>${patient.admissionId}</td>
        <td class="label">Adm Date:</td><td>${patient.admissionDate ? new Date(patient.admissionDate).toLocaleDateString("en-IN") : ""}</td>
      </tr>
      <tr>
        <td class="label">Patient Name:</td><td><b>${patient.title} ${patient.name}</b></td>
        <td class="label">Sex / Age:</td><td>${patient.gender} / ${patient.ageYears} Yrs</td>
      </tr>
      <tr>
        <td class="label">Bed:</td><td>${patient.bedNo || "—"} ${patient.bedCategory ? `(${patient.bedCategory})` : ""}</td>
        <td class="label">Doctor:</td><td>${patient.doctors?.map((d: any) => d.doctorName).join(", ") || "—"}</td>
      </tr>
      <tr>
        <td class="label">Discharge Date:</td><td>${dischargeDate ? new Date(dischargeDate).toLocaleDateString("en-IN") : ""}</td>
        <td class="label">Discharge Time:</td><td>${dischargeTime}</td>
      </tr>
      <tr>
        <td class="label">Discharge Type:</td><td>${dischargeType}</td>
        <td class="label">Referred To:</td><td>${referredTo || "—"}</td>
      </tr>
      <tr>
        <td class="label">Billing Days:</td><td>${billingDays} day(s)</td>
        <td class="label">Phone:</td><td>${patient.phone || "—"}</td>
      </tr>
    </table>
    ${billingSummary ? `
    <div class="section">Bill Summary</div>
    <div class="bill-summary">
      <div class="bill-row"><span>Gross Total</span><span>${fmtRs(billingSummary.gross)}</span></div>
      <div class="bill-row"><span>Total Discount</span><span>${fmtRs(billingSummary.discount)}</span></div>
      <div class="bill-row net"><span>Net Payable</span><span>${fmtRs(billingSummary.net)}</span></div>
    </div>` : ""}
    ${dischargeNote ? `<div class="section">Discharge Note</div><div class="note-box">${dischargeNote}</div>` : ""}
    ${adviceOnDischarge ? `<div class="section">Advice on Discharge</div><div class="note-box">${adviceOnDischarge}</div>` : ""}
    <div style="margin-top:60px;display:flex;justify-content:space-between">
      <div style="text-align:center;border-top:1px solid #999;padding-top:4px;width:200px;font-size:11px">
        Patient / Attender Signature
      </div>
      <div style="text-align:center;border-top:1px solid #999;padding-top:4px;width:200px;font-size:11px">
        Authorized Signatory
      </div>
    </div>
    <script>window.onload=function(){setTimeout(window.print,400)}<\/script>
    </body></html>`);
    win.document.close();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
  );
  if (!patient) return (
    <div className="flex items-center justify-center h-64 text-red-500">Patient not found</div>
  );

  const billingDays = patient.admissionDate
    ? computeBillingDays(new Date(patient.admissionDate))
    : 1;

  const admDays = patient.admissionDate
    ? Math.floor((Date.now() - new Date(patient.admissionDate).getTime()) / 86400000)
    : 0;

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
          <Button variant="outline" onClick={printDischargeNote} className="gap-2">
            <Printer className="h-4 w-4" /> Print Discharge Note
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
              <span>
                {patient.admissionDate
                  ? new Date(patient.admissionDate).toLocaleDateString("en-IN")
                  : "—"}
              </span>
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

      {/* Billing summary + billing days row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-indigo-100">
          <CardContent className="pt-3 pb-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CalendarDays className="h-4 w-4 text-indigo-500" />
              <p className="text-xs text-gray-500">Billing Days</p>
            </div>
            <p className="text-lg font-bold text-indigo-700">{billingDays}</p>
            <p className="text-[10px] text-gray-400">12 PM – 11:59 AM cycle</p>
          </CardContent>
        </Card>
        {billingSummary && (
          <>
            <Card>
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-xs text-gray-500">Gross Amount</p>
                <p className="text-lg font-bold text-blue-700">{fmtRs(billingSummary.gross)}</p>
                <p className="text-[10px] text-gray-400">{billingSummary.count} line items</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-xs text-gray-500">Discount</p>
                <p className="text-lg font-bold text-orange-600">{fmtRs(billingSummary.discount)}</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-xs text-gray-500">Net Payable</p>
                <p className="text-xl font-bold text-green-700">{fmtRs(billingSummary.net)}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Discharge details form */}
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
                value={dischargeDate}
                onChange={e => setDischargeDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Discharge Time</Label>
              <Input
                type="time"
                value={dischargeTime}
                onChange={e => setDischargeTime(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Discharge Type <span className="text-red-500">*</span></Label>
              <Select
                value={dischargeType || "none"}
                onValueChange={v => setDischargeType(v === "none" ? "" : v)}
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
                value={referredTo}
                onChange={e => setReferredTo(e.target.value)}
                className="h-9 text-sm"
                placeholder="Hospital / doctor"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discharge Note */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Discharge Note</CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-xs text-gray-500 block mb-1">
            Clinical summary, diagnosis, procedures performed, investigations…
          </Label>
          <textarea
            value={dischargeNote}
            onChange={e => setDischargeNote(e.target.value)}
            rows={10}
            placeholder="Enter discharge note here…"
            className="w-full border rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-red-400 font-mono"
          />
        </CardContent>
      </Card>

      {/* Advice on Discharge */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Advice on Discharge</CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-xs text-gray-500 block mb-1">
            Medications, diet, follow-up instructions, restrictions…
          </Label>
          <textarea
            value={adviceOnDischarge}
            onChange={e => setAdviceOnDischarge(e.target.value)}
            rows={8}
            placeholder="Enter advice on discharge…"
            className="w-full border rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-red-400 font-mono"
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
