import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Pencil, Trash2, Plus, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ipdService, {
  IPD_REFERRAL_DOCTORS, CatalogueService, ServiceGroup,
  buildServiceGroups, SERVICE_GROUP_META, computeBillingDays,
} from "@/services/ipdService";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  notes?: string;
  isAutoAdded?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }

function computeHours(fd: string, ft: string, td: string, tt: string): string {
  if (!fd || !td) return "";
  const from = new Date(`${fd}T${ft || "00:00"}`);
  const to   = new Date(`${td}T${tt || "00:00"}`);
  const ms   = to.getTime() - from.getTime();
  return ms > 0 ? String(Math.ceil(ms / 3600000)) : "";
}

function computeDays(fd: string, td: string): string {
  if (!fd || !td) return "";
  const ms = new Date(td).getTime() - new Date(fd).getTime();
  return ms >= 0 ? String(Math.floor(ms / 86400000) + 1) : "";
}

function fmtDateLabel(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", weekday: "short" });
}

function fmtDateShort(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtRs(n: number) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

const BLANK: {
  date: string; groupCode: string; serviceName: string;
  unitCharge: string; quantity: string; discount: string;
  doctorName: string; notes: string;
  fromDate: string; fromTime: string;
  toDate: string; toTime: string;
} = {
  date: todayStr(), groupCode: "", serviceName: "",
  unitCharge: "", quantity: "", discount: "",
  doctorName: "", notes: "",
  fromDate: "", fromTime: "",
  toDate: "", toTime: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function IpdServices() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient,       setPatient]       = useState<any>(null);
  const [entries,       setEntries]       = useState<BillingEntry[]>([]);
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);

  const [form,       setForm]       = useState({ ...BLANK });
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [filterGrp,  setFilterGrp]  = useState("__all__");

  const [isCustomSvc,   setIsCustomSvc]   = useState(false);
  const [customSvcName, setCustomSvcName] = useState("");

  const [doctorSearch, setDoctorSearch] = useState("");
  const [showDrDrop,   setShowDrDrop]   = useState(false);
  const doctorMatches = useMemo(
    () => doctorSearch.trim()
      ? IPD_REFERRAL_DOCTORS.filter(d => d.name.toLowerCase().includes(doctorSearch.toLowerCase()))
      : [],
    [doctorSearch]
  );

  const activeGroup: ServiceGroup | undefined =
    serviceGroups.find(g => g.code === form.groupCode);
  const activeService: CatalogueService | undefined =
    activeGroup?.services.find(s => s.name === form.serviceName);

  const needsDoctor  = activeService?.requiresDoctor || activeService?.isReferral;
  const isPerDay     = activeService?.unit?.toUpperCase().includes("DAY")  ?? false;
  const isPerHour    = activeService?.unit?.toUpperCase().includes("HOUR") ?? false;
  const isTimeBased  = isPerDay || isPerHour;

  const billingDays = patient?.admissionDate
    ? computeBillingDays(new Date(patient.admissionDate)) : 1;

  const amount    = (Number(form.unitCharge) || 0) * (Number(form.quantity) || 0);
  const netAmount = amount - (Number(form.discount) || 0);

  const loadCatalogue = async () => {
    try {
      const r = await ipdService.getServiceCatalogue();
      setServiceGroups(buildServiceGroups(r.data.data.items || []));
    } catch {
      setServiceGroups(SERVICE_GROUP_META.map(m => ({ code: m.code, name: m.name, services: [], allowCustom: m.allowCustom })));
    }
  };

  useEffect(() => { loadCatalogue(); }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([ipdService.getPatient(id), ipdService.getBillingEntries(id)])
      .then(([pr, br]) => { setPatient(pr.data.data); setEntries(br.data.data.entries || []); })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, [id]);

  const setF = <K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const onGroupChange = (code: string) => {
    const grp = serviceGroups.find(g => g.code === code);
    setIsCustomSvc(false); setCustomSvcName("");
    setForm(f => ({ ...f, groupCode: code, serviceName: "", unitCharge: "", doctorName: "", quantity: "", fromDate: "", fromTime: "", toDate: "", toTime: "" }));
    setDoctorSearch("");
    if (grp?.services.length === 1) {
      const svc = grp.services[0];
      const svcIsPerDay = svc.unit?.toUpperCase().includes("DAY");
      const defaultDr = svc.name === "CONSULTATION" ? (patient?.doctors?.[0]?.doctorName || "") : "";
      setForm(f => ({
        ...f, groupCode: code, serviceName: svc.name,
        unitCharge: svc.defaultCharge > 0 ? String(svc.defaultCharge) : "",
        quantity: svcIsPerDay ? String(billingDays) : "",
        doctorName: defaultDr, fromDate: "", fromTime: "", toDate: "", toTime: "",
      }));
      if (defaultDr) setDoctorSearch(defaultDr);
    }
  };

  const onServiceChange = (name: string) => {
    if (name === "__custom__") {
      setIsCustomSvc(true); setCustomSvcName("");
      setForm(f => ({ ...f, serviceName: "__custom__", unitCharge: "", quantity: "", doctorName: "", fromDate: "", fromTime: "", toDate: "", toTime: "" }));
      setDoctorSearch(""); return;
    }
    setIsCustomSvc(false); setCustomSvcName("");
    const grp = serviceGroups.find(g => g.code === form.groupCode);
    const svc = grp?.services.find(s => s.name === name);
    const svcIsPerDay = svc?.unit?.toUpperCase().includes("DAY");
    const defaultDr = name === "CONSULTATION" ? (patient?.doctors?.[0]?.doctorName || "") : "";
    setForm(f => ({
      ...f, serviceName: name,
      unitCharge: (svc?.defaultCharge ?? 0) > 0 ? String(svc!.defaultCharge) : "",
      quantity: svcIsPerDay ? String(billingDays) : "",
      doctorName: defaultDr, fromDate: "", fromTime: "", toDate: "", toTime: "",
    }));
    setDoctorSearch(defaultDr); setShowDrDrop(false);
  };

  const resetForm = () => {
    setForm({ ...BLANK }); setEditingId(null);
    setDoctorSearch(""); setShowDrDrop(false);
    setIsCustomSvc(false); setCustomSvcName("");
  };

  const handleFromToChange = (key: "fromDate" | "fromTime" | "toDate" | "toTime", val: string) => {
    setForm(f => {
      const next = { ...f, [key]: val };
      if (isTimeBased) {
        const qty = isPerHour
          ? computeHours(next.fromDate, next.fromTime, next.toDate, next.toTime)
          : computeDays(next.fromDate, next.toDate);
        if (qty) next.quantity = qty;
      }
      return next;
    });
  };

  const startEdit = (entry: BillingEntry) => {
    const grp = serviceGroups.find(g => g.name === entry.serviceGroup);
    setIsCustomSvc(false); setCustomSvcName("");
    setForm({
      date: entry.date?.slice(0, 10) || todayStr(), groupCode: grp?.code ?? "",
      serviceName: entry.serviceName,
      unitCharge: entry.unitCharge > 0 ? String(entry.unitCharge) : "",
      quantity:   entry.quantity   > 0 ? String(entry.quantity)   : "",
      discount:   entry.discount   > 0 ? String(entry.discount)   : "",
      doctorName: entry.doctorName || "", notes: entry.notes || "",
      fromDate: "", fromTime: "", toDate: "", toTime: "",
    });
    setDoctorSearch(entry.doctorName || ""); setEditingId(entry._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!form.groupCode) return toast.error("Select a service group");
    const finalServiceName = isCustomSvc ? customSvcName.trim() : form.serviceName;
    if (!finalServiceName || finalServiceName === "__custom__") return toast.error("Enter a service name");
    if (needsDoctor && !form.doctorName.trim()) return toast.error("Doctor name is required");
    const grp = activeGroup!;
    setSaving(true);
    try {
      const payload = {
        serviceGroup: grp.name, serviceGroupCode: grp.code, serviceName: finalServiceName,
        unit: activeService?.unit ?? "",
        quantity:   Number(form.quantity)   || 1,
        unitCharge: Number(form.unitCharge) || 0,
        discount:   Number(form.discount)   || 0,
        date: form.date,
        doctorName: form.doctorName.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editingId) {
        const res = await ipdService.updateBillingEntry(editingId, payload);
        setEntries(prev => prev.map(e => e._id === editingId ? res.data.data : e));
        toast.success("Entry updated");
      } else {
        const res = await ipdService.createBillingEntry(id!, payload);
        setEntries(prev => [...prev, res.data.data]);
        toast.success("Service added");
      }
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Remove this service entry?")) return;
    try {
      await ipdService.deleteBillingEntry(entryId);
      setEntries(prev => prev.filter(e => e._id !== entryId));
      if (editingId === entryId) resetForm();
      toast.success("Removed");
    } catch { toast.error("Delete failed"); }
  };

  const filtered = useMemo(() => {
    const list = filterGrp === "__all__" ? entries : entries.filter(e => e.serviceGroup === filterGrp);
    return [...list].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [entries, filterGrp]);

  const byDate = useMemo(() => {
    const map = new Map<string, BillingEntry[]>();
    filtered.forEach(e => {
      const d = e.date?.slice(0, 10) || "Unknown";
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(e);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const groupTotals = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => { map[e.serviceGroup] = (map[e.serviceGroup] || 0) + e.totalCharge; });
    return map;
  }, [entries]);

  const grossTotal    = entries.reduce((s, e) => s + e.unitCharge * e.quantity, 0);
  const totalDiscount = entries.reduce((s, e) => s + e.discount, 0);
  const netPayable    = entries.reduce((s, e) => s + e.totalCharge, 0);

  const usedGroups = useMemo(() => [...new Set(entries.map(e => e.serviceGroup))], [entries]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  if (!patient) return <div className="flex items-center justify-center h-64 text-red-500">Patient not found</div>;

  return (
    <div className="space-y-0 max-w-6xl text-sm">

      {/* Top bar */}
      <div className="flex items-center justify-between border-b pb-2 mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/ipd/edit/${id}`)} className="text-gray-500 hover:text-gray-700 p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-bold text-base text-gray-800">Services</span>
        </div>
        <Button size="sm" variant="outline" onClick={loadCatalogue} className="gap-1 h-8 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Patient header */}
      <div className="bg-gray-50 border rounded-md px-4 py-2.5 mb-3 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs">
        <div><span className="text-gray-400 mr-1">Adm No:</span><span className="font-semibold text-gray-800">{patient.admissionId}</span></div>
        <div>
          <span className="text-gray-400 mr-1">Adm Date:</span>
          <span>{patient.admissionDate ? fmtDateShort(patient.admissionDate) : "—"}</span>
          <span className="ml-2 text-gray-400">{patient.admissionTime}</span>
        </div>
        <div>
          <span className="text-gray-400 mr-1">Patient:</span>
          <span className="font-semibold">{patient.title} {patient.name}</span>
          <span className="text-gray-400 ml-1">({patient.gender} {patient.ageYears}Y)</span>
        </div>
        <div><span className="text-gray-400 mr-1">Bed:</span><span>{patient.bedCategory ? `${patient.bedCategory} (${patient.bedNo})` : patient.bedNo || "—"}</span></div>
        <div><span className="text-gray-400 mr-1">Attending Dr:</span><span>{patient.doctors?.map((d: any) => d.doctorName).join(", ") || "—"}</span></div>
        <div>
          <span className="text-gray-400 mr-1">Billing Days:</span>
          <span className="font-semibold text-indigo-700">{billingDays}</span>
          <span className="text-gray-400 ml-1 text-[10px]">(12PM cycle)</span>
        </div>
        <div>
          <span className="text-gray-400 mr-1">Status:</span>
          <span className={patient.status === "Admitted" ? "text-green-600 font-medium" : "text-gray-500"}>{patient.status}</span>
        </div>
      </div>

      {/* Add Service form */}
      <div className="border rounded-md bg-white mb-4">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 rounded-t-md">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {editingId ? "✏ Edit Service Entry" : "Add Service"}
          </span>
          {editingId && (
            <button onClick={resetForm} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> Cancel Edit
            </button>
          )}
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Row 1: Date + Group + Service */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Service Date</Label>
              <Input type="date" value={form.date} onChange={e => setF("date", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Service Group <span className="text-red-500">*</span></Label>
              <Select value={form.groupCode || "__none__"} onValueChange={v => onGroupChange(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="— Select Group —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select Group —</SelectItem>
                  {serviceGroups.map(g => <SelectItem key={g.code} value={g.code}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Service <span className="text-red-500">*</span></Label>
              {activeGroup && (activeGroup.services.length > 0 || activeGroup.allowCustom) ? (
                <Select value={form.serviceName || "__none__"} onValueChange={v => onServiceChange(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="— Select Service —" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="__none__">— Select Service —</SelectItem>
                    {activeGroup.services.map(s => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name}
                        {s.defaultCharge > 0 && <span className="ml-2 text-gray-400 text-[10px]">₹{s.defaultCharge}/{s.unit}</span>}
                      </SelectItem>
                    ))}
                    {activeGroup.allowCustom && <SelectItem value="__custom__">+ Custom / Other</SelectItem>}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.serviceName} onChange={e => setF("serviceName", e.target.value)}
                  className="h-8 text-xs" placeholder={activeGroup ? "Enter service name" : "Select a group first"} />
              )}
              {isCustomSvc && (
                <Input className="h-8 text-xs mt-1" placeholder="Enter custom service name"
                  value={customSvcName} onChange={e => setCustomSvcName(e.target.value)} autoFocus />
              )}
            </div>
          </div>

          {/* From/To for time-based services */}
          {isTimeBased && (
            <div className={`grid gap-3 ${isPerHour ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">From Date</Label>
                <Input type="date" value={form.fromDate} onChange={e => handleFromToChange("fromDate", e.target.value)} className="h-8 text-xs" />
              </div>
              {isPerHour && (
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">From Time</Label>
                  <Input type="time" value={form.fromTime} onChange={e => handleFromToChange("fromTime", e.target.value)} className="h-8 text-xs" />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">To Date</Label>
                <Input type="date" value={form.toDate} onChange={e => handleFromToChange("toDate", e.target.value)} className="h-8 text-xs" />
              </div>
              {isPerHour && (
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">To Time</Label>
                  <Input type="time" value={form.toTime} onChange={e => handleFromToChange("toTime", e.target.value)} className="h-8 text-xs" />
                </div>
              )}
            </div>
          )}

          {/* Rate, Qty, Amount, Discount, Net */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Rate (₹)</Label>
              <Input type="number" min={0} value={form.unitCharge} onChange={e => setF("unitCharge", e.target.value)} className="h-8 text-xs" placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500 flex gap-1">
                Quantity
                {isTimeBased && <span className="text-indigo-400 font-normal">{isPerHour ? "(auto: hrs)" : "(auto: days)"}</span>}
              </Label>
              <Input type="number" min={1} value={form.quantity} onChange={e => setF("quantity", e.target.value)} className="h-8 text-xs" placeholder="1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Amount (₹)</Label>
              <Input readOnly value={amount || ""} className="h-8 text-xs bg-gray-50 font-medium" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Discount (₹)</Label>
              <Input type="number" min={0} value={form.discount} onChange={e => setF("discount", e.target.value)} className="h-8 text-xs" placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Net Amount (₹)</Label>
              <Input readOnly value={netAmount || ""} className="h-8 text-xs bg-gray-50 font-bold text-green-700" />
            </div>
          </div>

          {/* Doctor + Remarks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {needsDoctor && (
              <div className="space-y-1 relative">
                <Label className="text-xs text-gray-500">{activeService?.isReferral ? "Referral Doctor *" : "Doctor Name *"}</Label>
                <Input value={doctorSearch}
                  onChange={e => { setDoctorSearch(e.target.value); setF("doctorName", e.target.value); setShowDrDrop(true); }}
                  onFocus={() => setShowDrDrop(true)}
                  onBlur={() => setTimeout(() => setShowDrDrop(false), 150)}
                  className="h-8 text-xs" placeholder="Search doctor name…" />
                {showDrDrop && doctorMatches.length > 0 && (
                  <div className="absolute z-30 top-full left-0 right-0 border bg-white rounded-md shadow-xl max-h-44 overflow-y-auto">
                    {doctorMatches.map(d => (
                      <button key={d.code} type="button"
                        onMouseDown={() => { setF("doctorName", d.name); setDoctorSearch(d.name); setShowDrDrop(false); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex justify-between items-center">
                        <span className="font-medium">{d.name}</span>
                        {d.speciality && <span className="text-gray-400 text-[10px]">{d.speciality}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Remarks</Label>
              <Input value={form.notes} onChange={e => setF("notes", e.target.value)} className="h-8 text-xs" placeholder="Optional remarks…" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSubmit} disabled={saving} className="h-8 text-xs bg-green-600 hover:bg-green-700 px-5 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {saving ? "Saving…" : editingId ? "Update Entry" : "Add Service"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} className="h-8 text-xs px-4">Clear</Button>
          </div>
        </div>
      </div>

      {/* Service Details table */}
      <div className="border rounded-md bg-white">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 rounded-t-md">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Service Details <Badge variant="secondary" className="ml-2 text-[10px]">{entries.length}</Badge>
          </span>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-400 shrink-0">Filter:</Label>
            <Select value={filterGrp} onValueChange={setFilterGrp}>
              <SelectTrigger className="h-7 text-xs w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">— All Groups —</SelectItem>
                {usedGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10">No services added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600">
                  <th className="px-3 py-2 text-left font-medium w-24">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Group</th>
                  <th className="px-3 py-2 text-left font-medium">Service Name</th>
                  <th className="px-3 py-2 text-center font-medium w-10">Qty</th>
                  <th className="px-3 py-2 text-right font-medium w-20">Rate</th>
                  <th className="px-3 py-2 text-left font-medium w-16">Unit</th>
                  <th className="px-3 py-2 text-right font-medium w-20">Amount</th>
                  <th className="px-3 py-2 text-right font-medium w-20">Net Amt</th>
                  <th className="px-3 py-2 text-left font-medium">Doctor / Remarks</th>
                  <th className="px-3 py-2 w-16 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {byDate.map(([dateStr, dayEntries]) => (
                  <>
                    <tr key={`hdr-${dateStr}`} className="bg-indigo-50 border-t border-b border-indigo-100">
                      <td colSpan={10} className="px-3 py-1.5">
                        <span className="text-xs font-semibold text-indigo-700">{fmtDateLabel(dateStr)}</span>
                        <span className="ml-3 text-[10px] text-indigo-400">
                          {dayEntries.length} service{dayEntries.length !== 1 ? "s" : ""} · {fmtRs(dayEntries.reduce((s, e) => s + e.totalCharge, 0))}
                        </span>
                      </td>
                    </tr>
                    {dayEntries.map(entry => (
                      <tr key={entry._id} className={`border-b hover:bg-gray-50 transition-colors ${editingId === entry._id ? "bg-yellow-50" : ""}`}>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDateShort(entry.date)}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">{entry.serviceGroup}</span>
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {entry.serviceName}
                          {entry.isAutoAdded && <span className="ml-1 text-[9px] text-blue-400 font-normal">AUTO</span>}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700">{entry.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmtRs(entry.unitCharge)}</td>
                        <td className="px-3 py-2 text-gray-400 text-[10px]">{entry.unit || "—"}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmtRs(entry.unitCharge * entry.quantity)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">
                          {fmtRs(entry.totalCharge)}
                          {entry.discount > 0 && <div className="text-[10px] text-orange-500 font-normal">-{fmtRs(entry.discount)}</div>}
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-[10px] max-w-30">
                          {entry.doctorName && <div className="font-medium text-gray-700 truncate">{entry.doctorName}</div>}
                          {entry.notes && <div className="italic truncate">{entry.notes}</div>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => startEdit(entry)} className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDelete(entry._id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {Object.keys(groupTotals).length > 0 && (
          <div className="border-t bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Charge Summary by Group</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1">
              {Object.entries(groupTotals).map(([grp, total]) => (
                <div key={grp} className="flex justify-between text-xs border-b border-dashed border-gray-200 pb-1">
                  <span className="text-gray-500 truncate">TOTAL {grp}:</span>
                  <span className="font-semibold text-gray-800 shrink-0 ml-2">{fmtRs(total)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 justify-end border-t pt-3">
              <div className="text-xs"><span className="text-gray-500">Gross Total: </span><span className="font-semibold text-gray-800">{fmtRs(grossTotal)}</span></div>
              <div className="text-xs"><span className="text-gray-500">Discount: </span><span className="font-semibold text-orange-600">{fmtRs(totalDiscount)}</span></div>
              <div className="text-sm"><span className="text-gray-600 font-medium">Net Payable: </span><span className="font-bold text-green-700 text-base">{fmtRs(netPayable)}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
