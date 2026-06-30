import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, BedDouble, Trash2, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import ipdService, { BED_CATEGORIES, BED_CHARGES, computeBillingDays } from "@/services/ipdService";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}
function fmt(n: number) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });
}
function fmtDate(d: string | Date | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

interface Allotment {
  _id: string;
  bedCategory: string;
  bedNo: string;
  charge: number;
  allotmentDate: string;
  allotmentTime?: string;
  endDate?: string;
  endTime?: string;
  effectiveTime?: string;
  effectiveEndTime?: string;
  packageDays?: number;
  includeInPackage?: boolean;
  cashService?: boolean;
  isCurrent?: boolean;
  billingDays?: number;
  totalCharge?: number;
}

const BLANK_FORM = {
  bedCategory:      "",
  bedNo:            "",
  charge:           0,
  allotmentDate:    todayStr(),
  allotmentTime:    nowTime(),
  effectiveTime:    nowTime(),
  packageDays:      0,
  includeInPackage: false,
  cashService:      false,
};

export default function IpdBedAllotment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();

  const [patient,    setPatient]    = useState<any>(null);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState({ ...BLANK_FORM });
  const [liveNow,    setLiveNow]    = useState(() => new Date());
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editEnd,    setEditEnd]    = useState({ allotmentDate: "", allotmentTime: "", endDate: "", endTime: "", charge: "" });
  const [occupiedBeds, setOccupiedBeds] = useState<{ _id: string; bedCategory: string; bedNo: string }[]>([]);

  const occupiedNos = new Set(
    occupiedBeds
      .filter(b => b.bedCategory === form.bedCategory && b._id !== id)
      .map(b => b.bedNo)
  );
  const availableBeds = (BED_CATEGORIES.find(c => c.category === form.bedCategory)?.beds ?? [])
    .filter(b => !occupiedNos.has(b));

  useEffect(() => {
    if (!id) return;
    Promise.all([
      ipdService.getPatient(id),
      ipdService.getBedAllotments(id),
      ipdService.getOccupiedBeds(),
    ]).then(([pr, ar, ob]) => {
      setPatient(pr.data.data);
      setAllotments(ar.data.data.allotments || []);
      setOccupiedBeds(ob.data.data.beds || []);
    }).catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setLiveNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const set = (field: string, val: any) =>
    setForm(f => ({ ...f, [field]: val }));

  const handleBedCategory = (cat: string) => {
    const defaultCharge = BED_CHARGES[cat] ?? 0;
    setForm(f => ({ ...f, bedCategory: cat, bedNo: "", charge: defaultCharge }));
  };

  const handleSubmit = async () => {
    if (!form.bedCategory) return toast.error("Select a bed category");
    if (!form.bedNo)        return toast.error("Select a bed number");
    if (!form.allotmentDate) return toast.error("Allotment date is required");
    if (!(await confirm({ title: "Save bed allotment?", description: "This will allot the bed and update the patient's current bed.", confirmText: "Yes, save" }))) return;
    setSaving(true);
    try {
      await ipdService.createBedAllotment(id!, form);
      toast.success("Bed allotment saved — patient bed updated");
      setShowForm(false);
      setForm({ ...BLANK_FORM });
      const [pr, ar] = await Promise.all([
        ipdService.getPatient(id!),
        ipdService.getBedAllotments(id!),
      ]);
      setPatient(pr.data.data);
      setAllotments(ar.data.data.allotments || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save allotment");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (allotmentId: string) => {
    if (!(await confirm({
      title: "Delete allotment entry?",
      description: "This bed allotment entry will be permanently deleted.",
      confirmText: "Yes, delete",
      destructive: true,
    }))) return;
    try {
      await ipdService.deleteBedAllotment(allotmentId);
      setAllotments(prev => prev.filter(a => a._id !== allotmentId));
      toast.success("Allotment deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleSaveEnd = async (allotmentId: string) => {
    const chargeVal = parseFloat(editEnd.charge);
    if (editEnd.charge !== "" && (isNaN(chargeVal) || chargeVal < 0))
      return toast.error("Enter a valid charge");
    if (!(await confirm({ title: "Save changes?", description: "This will update this bed allotment entry." }))) return;
    try {
      const payload: any = {
        endDate: editEnd.endDate,
        endTime: editEnd.endTime || undefined,
      };
      if (editEnd.allotmentDate) payload.allotmentDate = editEnd.allotmentDate;
      if (editEnd.allotmentTime) payload.allotmentTime = editEnd.allotmentTime;
      if (editEnd.charge !== "") payload.charge = chargeVal;
      await ipdService.updateBedAllotment(allotmentId, payload);
      setEditingId(null);
      const ar = await ipdService.getBedAllotments(id!);
      setAllotments(ar.data.data.allotments || []);
      toast.success("Allotment updated");
    } catch {
      toast.error("Failed to save");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  if (!patient) return <div className="flex items-center justify-center h-64 text-red-500">Patient not found</div>;

  // Mirror the same priority used by the Billing page:
  //   discharge date (if set) → estimate/reference date → live now
  const isDischargedRef  = Boolean(patient.dischargeDate);
  const hasManualEstimate = Boolean(patient.dischargeDate || patient.estimateEndDate);
  const openEndDate: Date = patient.dischargeDate
    ? new Date(patient.dischargeDate)
    : (patient.estimateEndDate ? new Date(patient.estimateEndDate) : liveNow);

  const totalBedCharge = allotments.reduce((s, a) => {
    if (!a.allotmentDate) return s;
    const days = a.endDate
      ? computeBillingDays(new Date(a.allotmentDate), new Date(a.endDate))
      : computeBillingDays(new Date(a.allotmentDate), openEndDate);
    return s + days * (a.charge || 0);
  }, 0);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/ipd/edit/${id}`)} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Bed Allotment</h1>
            <p className="text-gray-500 text-sm font-mono">{patient.admissionId}</p>
          </div>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="h-4 w-4" /> Shift / Allot Bed
          </Button>
        )}
      </div>

      {/* Patient summary */}
      <Card className="border-blue-100 bg-blue-50">
        <CardContent className="pt-3 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-gray-500 block">Patient</span>
              <span className="font-semibold">{patient.title} {patient.name}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Current Bed</span>
              <span className="font-semibold">{patient.bedNo || "—"} {patient.bedCategory ? `(${patient.bedCategory})` : ""}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Admitted</span>
              <span>{fmtDate(patient.admissionDate)}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Attending Doctor(s)</span>
              <span className="font-medium">{patient.doctors?.map((d: any) => d.doctorName).join(", ") || "—"}</span>
            </div>
            <div className="md:col-span-2">
              <span className="text-xs text-gray-500 block">
                Total Bed Charge
                {isDischargedRef && <span className="ml-1 text-red-500">(till discharge)</span>}
                {!isDischargedRef && hasManualEstimate && <span className="ml-1 text-amber-600">(ref date)</span>}
              </span>
              <span className="font-bold text-indigo-700">{fmt(totalBedCharge)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Allotment Form */}
      {showForm && (
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-green-600" /> New Bed Allotment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1 min-w-0">
                <Label className="text-xs">Bed Category <span className="text-red-500">*</span></Label>
                <Select value={form.bedCategory || "none"} onValueChange={v => handleBedCategory(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-9 text-sm w-full truncate">
                    <SelectValue placeholder="-- Select --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Select --</SelectItem>
                    {BED_CATEGORIES.map(c => (
                      <SelectItem key={c.category} value={c.category}>
                        {c.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Bed No <span className="text-red-500">*</span></Label>
                <Select value={form.bedNo || "none"} onValueChange={v => set("bedNo", v === "none" ? "" : v)} disabled={!form.bedCategory}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="-- Select --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Select --</SelectItem>
                    {availableBeds.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Charge / Day (₹)</Label>
                <Input
                  type="number"
                  value={form.charge || ""}
                  onChange={e => set("charge", Number(e.target.value))}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Allotment Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.allotmentDate}
                  onChange={e => set("allotmentDate", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Allotment Time</Label>
                <Input
                  type="time"
                  value={form.allotmentTime}
                  onChange={e => set("allotmentTime", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Effective Time</Label>
                <Input
                  type="time"
                  value={form.effectiveTime}
                  onChange={e => set("effectiveTime", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Package Days</Label>
                <Input
                  type="number"
                  value={form.packageDays || ""}
                  onChange={e => set("packageDays", Number(e.target.value))}
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex flex-col justify-end gap-2 pb-0.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.includeInPackage}
                    onChange={e => set("includeInPackage", e.target.checked)}
                    className="rounded"
                  />
                  Include In Package
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.cashService}
                    onChange={e => set("cashService", e.target.checked)}
                    className="rounded"
                  />
                  Cash Service
                </label>
              </div>
            </div>

            {form.bedCategory && (
              <div className="text-xs text-blue-600 bg-blue-50 rounded px-3 py-2">
                Previous bed will be marked closed at this allotment date/time. Patient's bed record will be updated to {form.bedCategory} — {form.bedNo || "?"}.
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => { setShowForm(false); setForm({ ...BLANK_FORM }); }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? "Saving…" : "Save Allotment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Allotment History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Allotment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allotments.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400">
              <BedDouble className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No bed allotments recorded.</p>
              <p className="text-xs mt-1">Allotments are created when a patient shifts bed/ward.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-2 font-medium whitespace-nowrap">Bed Category</th>
                  <th className="text-left px-4 py-2 font-medium whitespace-nowrap">Bed No</th>
                  <th className="text-right px-4 py-2 font-medium">Rate/Day</th>
                  <th className="text-left px-4 py-2 font-medium">From</th>
                  <th className="text-left px-4 py-2 font-medium">To</th>
                  <th className="text-center px-4 py-2 font-medium">Days</th>
                  <th className="text-right px-4 py-2 font-medium">Charge</th>
                  <th className="text-center px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {allotments.map(a => {
                  const isEditing = editingId === a._id;
                  const effectiveFrom = isEditing && editEnd.allotmentDate
                    ? new Date(editEnd.allotmentDate)
                    : new Date(a.allotmentDate);
                  const effectiveTo = isEditing
                    ? (editEnd.endDate ? new Date(editEnd.endDate) : openEndDate)
                    : (a.endDate ? new Date(a.endDate) : openEndDate);
                  const days = computeBillingDays(effectiveFrom, effectiveTo);
                  const charge = days * (isEditing && editEnd.charge !== "" ? parseFloat(editEnd.charge) || 0 : (a.charge || 0));
                  return (
                    <tr key={a._id} className="border-t">
                      <td className="px-4 py-2 font-medium whitespace-nowrap">{a.bedCategory}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{a.bedNo}</td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editEnd.charge}
                            onChange={e => setEditEnd(v => ({ ...v, charge: e.target.value }))}
                            className="h-7 text-xs w-24 text-right"
                            placeholder={String(a.charge)}
                          />
                        ) : fmt(a.charge)}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="date"
                              value={editEnd.allotmentDate}
                              onChange={e => setEditEnd(v => ({ ...v, allotmentDate: e.target.value }))}
                              className="h-7 text-xs w-32"
                            />
                            <Input
                              type="time"
                              value={editEnd.allotmentTime}
                              onChange={e => setEditEnd(v => ({ ...v, allotmentTime: e.target.value }))}
                              className="h-7 text-xs w-24"
                            />
                          </div>
                        ) : (
                          <>
                            {fmtDate(a.allotmentDate)}
                            {a.allotmentTime ? <span className="text-xs text-gray-400 ml-1">{a.allotmentTime}</span> : ""}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <Input
                                type="date"
                                value={editEnd.endDate}
                                onChange={e => setEditEnd(v => ({ ...v, endDate: e.target.value }))}
                                className="h-7 text-xs w-32"
                                placeholder="optional"
                              />
                              <Input
                                type="time"
                                value={editEnd.endTime}
                                onChange={e => setEditEnd(v => ({ ...v, endTime: e.target.value }))}
                                className="h-7 text-xs w-24"
                              />
                            </div>
                            {!editEnd.endDate && (
                              <span className="text-[10px] text-green-600 font-medium">Active (live)</span>
                            )}
                          </div>
                        ) : a.endDate ? (
                          <>
                            {fmtDate(a.endDate)}
                            {a.endTime ? <span className="text-xs text-gray-400 ml-1">{a.endTime}</span> : ""}
                          </>
                        ) : isDischargedRef ? (
                          <span className="text-xs text-red-600 font-medium">
                            {fmtDate(openEndDate)} <span className="text-gray-400">(discharge date)</span>
                          </span>
                        ) : hasManualEstimate ? (
                          <span className="text-xs text-amber-600 font-medium">
                            {fmtDate(openEndDate)} <span className="text-gray-400">(ref date)</span>
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 font-medium">Active (live)</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center font-semibold">{days}</td>
                      <td className="px-4 py-2 text-right font-semibold text-indigo-700">{fmt(charge)}</td>
                      <td className="px-4 py-2 text-center">
                        {a.isCurrent
                          ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Active</Badge>
                          : <Badge variant="outline" className="text-gray-400 text-[10px]">Closed</Badge>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                className="h-6 text-[10px] px-2 bg-indigo-600 hover:bg-indigo-700"
                                onClick={() => handleSaveEnd(a._id)}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] px-2 text-gray-500"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] px-2 text-indigo-500 hover:text-indigo-700"
                              onClick={() => {
                                setEditingId(a._id);
                                setEditEnd({
                                  allotmentDate: a.allotmentDate ? new Date(a.allotmentDate).toISOString().slice(0, 10) : "",
                                  allotmentTime: a.allotmentTime || "",
                                  endDate: a.endDate ? new Date(a.endDate).toISOString().slice(0, 10) : "",
                                  endTime: a.endDate ? (a.endTime || "") : "",
                                  charge:  String(a.charge || ""),
                                });
                              }}
                            >
                              Edit
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-600"
                            onClick={() => handleDelete(a._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total */}
      {allotments.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="pt-3 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold text-indigo-800">Total Bed Charge</span>
            </div>
            <span className="text-2xl font-bold text-indigo-700">{fmt(totalBedCharge)}</span>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog />
    </div>
  );
}
