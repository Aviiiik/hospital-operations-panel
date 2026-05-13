import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Pencil, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import ipdService, { InvestigationVendor } from "@/services/ipdService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvItem {
  slNo:        number;
  code:        string;
  description: string;
  amount:      string;
  reportDate:  string;
  remark:      string;
  category:    string;
  caseNo:      string;
  netAmount:   string;
}

interface Investigation {
  _id:              string;
  reqNo:            string;
  reqDate:          string;
  reqTime:          string;
  collectionCentre: string;
  guardianName:     string;
  patientName:      string;
  items:            any[];
  totalAmount:      number;
  isUrgent:         boolean;
  referredBy:       string;
  organisation:     string;
  remarks:          string;
  vendor:           string;
  vendorBillNo:     string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLECTION_CENTRES = ["IPD", "OPD", "EXTERNAL"];

const INVESTIGATION_CATEGORIES = [
  "BLOOD", "URINE", "STOOL", "MICROBIOLOGY", "BIOCHEMISTRY",
  "PATHOLOGY", "RADIOLOGY", "CARDIOLOGY", "ENDOSCOPY", "OTHER",
];

const EMPTY_ITEM: InvItem = {
  slNo: 1, code: "", description: "", amount: "",
  reportDate: "", remark: "", category: "", caseNo: "", netAmount: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }

function nowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "2-digit",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IpdInvestigation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient,        setPatient]        = useState<any>(null);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [vendors,        setVendors]        = useState<InvestigationVendor[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [listOpen,       setListOpen]       = useState(true);

  // Form state
  const [editingId,        setEditingId]        = useState<string | null>(null);
  const [collectionCentre, setCollectionCentre] = useState("IPD");
  const [reqDate,          setReqDate]          = useState(todayStr());
  const [reqTime,          setReqTime]          = useState(nowTimeStr());
  const [guardianName,     setGuardianName]     = useState("");
  const [referredBy,       setReferredBy]       = useState("");
  const [organisation,     setOrganisation]     = useState("");
  const [remarks,          setRemarks]          = useState("");
  const [vendorId,         setVendorId]         = useState("__none__");
  const [vendorBillNo,     setVendorBillNo]     = useState("");
  const [isUrgent,         setIsUrgent]         = useState(false);
  const [items,            setItems]            = useState<InvItem[]>([{ ...EMPTY_ITEM }]);

  // Add vendor dialog
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [newVendorCode, setNewVendorCode] = useState("");
  const [newVendorName, setNewVendorName] = useState("");
  const [savingVendor,  setSavingVendor]  = useState(false);

  const totalAmount = useMemo(
    () => items.reduce((s, it) => s + (Number(it.netAmount) || 0), 0),
    [items]
  );

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    Promise.all([
      ipdService.getPatient(id),
      ipdService.getInvestigations(id),
      ipdService.getVendors(),
    ]).then(([pr, ir, vr]) => {
      setPatient(pr.data.data);
      setInvestigations(ir.data.data.investigations || []);
      setVendors(vr.data.data.vendors || []);
    }).catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (patient) setReferredBy(patient.doctors?.[0]?.doctorName || "");
  }, [patient]);

  // ── Form helpers ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingId(null);
    setCollectionCentre("IPD");
    setReqDate(todayStr());
    setReqTime(nowTimeStr());
    setGuardianName("");
    setReferredBy(patient?.doctors?.[0]?.doctorName || "");
    setOrganisation("");
    setRemarks("");
    setVendorId("__none__");
    setVendorBillNo("");
    setIsUrgent(false);
    setItems([{ ...EMPTY_ITEM }]);
  };

  const loadForEdit = (inv: Investigation) => {
    setEditingId(inv._id);
    setCollectionCentre(inv.collectionCentre || "IPD");
    setReqDate(inv.reqDate ? inv.reqDate.slice(0, 10) : todayStr());
    setReqTime(inv.reqTime || "");
    setGuardianName(inv.guardianName || "");
    setReferredBy(inv.referredBy || "");
    setOrganisation(inv.organisation || "");
    setRemarks(inv.remarks || "");
    setVendorBillNo(inv.vendorBillNo || "");
    setIsUrgent(inv.isUrgent || false);
    // resolve saved vendor name back to _id
    const found = vendors.find(v => v.name === inv.vendor);
    setVendorId(found ? found._id : "__none__");
    setItems(
      inv.items?.length
        ? inv.items.map((it, i) => ({
            slNo:        i + 1,
            code:        it.code        || "",
            description: it.description || "",
            amount:      it.amount  > 0 ? String(it.amount)    : "",
            reportDate:  it.reportDate  ? String(it.reportDate).slice(0, 10) : "",
            remark:      it.remark      || "",
            category:    it.category    || "",
            caseNo:      it.caseNo      || "",
            netAmount:   it.netAmount > 0 ? String(it.netAmount) : "",
          }))
        : [{ ...EMPTY_ITEM }]
    );
    setListOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setItem = (idx: number, field: keyof InvItem, val: string) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: val };
      if (field === "amount" && !it.netAmount) updated.netAmount = val;
      return updated;
    }));
  };

  const addItem = () =>
    setItems(prev => [...prev, { ...EMPTY_ITEM, slNo: prev.length + 1 }]);

  const removeItem = (idx: number) =>
    setItems(prev =>
      prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, slNo: i + 1 }))
    );

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!items.some(it => it.description.trim()))
      return toast.error("Add at least one investigation item");
    if (!id) return;

    const resolvedVendor = vendorId === "__none__"
      ? ""
      : (vendors.find(v => v._id === vendorId)?.name || "");

    setSaving(true);
    try {
      const payload = {
        collectionCentre, reqDate, reqTime,
        guardianName, referredBy, organisation,
        remarks, vendor: resolvedVendor, vendorBillNo, isUrgent,
        items: items
          .filter(it => it.description.trim())
          .map((it, i) => ({
            ...it, slNo: i + 1,
            amount:    Number(it.amount)    || 0,
            netAmount: Number(it.netAmount) || 0,
          })),
      };

      if (editingId) {
        const res = await ipdService.updateInvestigation(editingId, payload);
        setInvestigations(prev =>
          prev.map(inv => inv._id === editingId ? res.data.data : inv)
        );
        toast.success("Investigation updated");
      } else {
        const res = await ipdService.createInvestigation(id, payload);
        setInvestigations(prev => [res.data.data, ...prev]);
        toast.success("Requisition saved");
      }
      resetForm();
      setListOpen(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (invId: string) => {
    if (!confirm("Delete this requisition?")) return;
    try {
      await ipdService.deleteInvestigation(invId);
      setInvestigations(prev => prev.filter(inv => inv._id !== invId));
      if (editingId === invId) resetForm();
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  // ── Add Vendor ─────────────────────────────────────────────────────────────
  const handleAddVendor = async () => {
    if (!newVendorCode.trim() || !newVendorName.trim())
      return toast.error("Code and name are required");
    setSavingVendor(true);
    try {
      const res = await ipdService.createVendor({
        code: newVendorCode.trim().toUpperCase(),
        name: newVendorName.trim().toUpperCase(),
      });
      const created: InvestigationVendor = res.data.data;
      setVendors(prev => [...prev, created].sort((a, b) => a.code.localeCompare(b.code)));
      setVendorId(created._id);
      setShowAddVendor(false);
      setNewVendorCode(""); setNewVendorName("");
      toast.success("Vendor added");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add vendor");
    } finally {
      setSavingVendor(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
  );
  if (!patient) return (
    <div className="flex items-center justify-center h-64 text-red-500">Patient not found</div>
  );

  return (
    <div className="space-y-3 text-sm">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 border-b pb-2">
        <button onClick={() => navigate(`/ipd/edit/${id}`)}
          className="text-gray-500 hover:text-gray-700 p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-bold text-base text-gray-800">Investigation Requisition</span>
      </div>

      {/* ── Patient header ── */}
      <div className="bg-gray-50 border rounded-md px-4 py-2.5 grid grid-cols-3 md:grid-cols-6 gap-x-6 gap-y-1 text-xs">
        <div>
          <span className="text-gray-400 mr-1">Adm No:</span>
          <span className="font-semibold text-gray-800">{patient.admissionId}</span>
        </div>
        <div>
          <span className="text-gray-400 mr-1">Patient:</span>
          <span className="font-semibold">{patient.title} {patient.name}</span>
        </div>
        <div>
          <span className="text-gray-400 mr-1">Sex/Age:</span>
          <span>{patient.gender} / {patient.ageYears}Y</span>
        </div>
        <div>
          <span className="text-gray-400 mr-1">Phone:</span>
          <span>{patient.phone || "—"}</span>
        </div>
        <div>
          <span className="text-gray-400 mr-1">Bed:</span>
          <span>
            {patient.bedCategory
              ? `${patient.bedCategory} (${patient.bedNo})`
              : patient.bedNo || "—"}
          </span>
        </div>
        <div>
          <span className="text-gray-400 mr-1">Dr:</span>
          <span>{patient.doctors?.map((d: any) => d.doctorName).join(", ") || "—"}</span>
        </div>
      </div>

      {/* ── Previous requisitions (collapsible table) ── */}
      <div className="border rounded-md bg-white">
        <button
          className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 rounded-t-md hover:bg-gray-100 transition-colors"
          onClick={() => setListOpen(v => !v)}
        >
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            Previous Requisitions
            <Badge variant="secondary" className="text-[10px]">{investigations.length}</Badge>
          </span>
          {listOpen
            ? <ChevronUp className="h-4 w-4 text-gray-400" />
            : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>

        {listOpen && (
          investigations.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No requisitions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-t border-b text-gray-600">
                    <th className="px-3 py-2 text-left font-medium">Req No</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Time</th>
                    <th className="px-3 py-2 text-left font-medium">Centre</th>
                    <th className="px-3 py-2 text-left font-medium">Vendor</th>
                    <th className="px-3 py-2 text-center font-medium">Items</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-center font-medium">Urgent</th>
                    <th className="px-3 py-2 text-center font-medium w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {investigations.map(inv => (
                    <tr key={inv._id}
                      className={`border-b hover:bg-gray-50 transition-colors
                        ${editingId === inv._id ? "bg-yellow-50" : ""}`}>
                      <td className="px-3 py-2 font-mono font-semibold text-gray-800">{inv.reqNo}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(inv.reqDate)}</td>
                      <td className="px-3 py-2 text-gray-500">{inv.reqTime || "—"}</td>
                      <td className="px-3 py-2 text-gray-500">{inv.collectionCentre || "—"}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-30 truncate">
                        {inv.vendor || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600">{inv.items?.length || 0}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">
                        ₹{inv.totalAmount?.toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {inv.isUrgent
                          ? <span className="text-red-500 font-semibold text-[10px]">URGENT</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => loadForEdit(inv)}
                            className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(inv._id)}
                            className="p-1 text-red-400 hover:bg-red-50 rounded" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ── Requisition form (full width) ── */}
      <div className="border rounded-md bg-white">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 rounded-t-md">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {editingId ? "✏ Edit Requisition" : "New Requisition"}
          </span>
          {editingId && (
            <button onClick={resetForm}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> Cancel Edit
            </button>
          )}
        </div>

        <div className="px-4 py-3 space-y-3">

          {/* Row 1: Collection Centre | Date | Time | Urgent */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Collection Centre</Label>
              <Select value={collectionCentre} onValueChange={setCollectionCentre}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLLECTION_CENTRES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Req Date</Label>
              <Input type="date" value={reqDate}
                onChange={e => setReqDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Time</Label>
              <Input type="time" value={reqTime}
                onChange={e => setReqTime(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="md:col-span-2 flex items-end pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isUrgent}
                  onChange={e => setIsUrgent(e.target.checked)}
                  className="h-4 w-4 accent-red-600 cursor-pointer" />
                <span className="text-xs font-semibold text-red-600">Urgent Sample</span>
              </label>
            </div>
          </div>

          {/* Row 2: Guardian Name | Referred By | Organisation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Guardian Name</Label>
              <Input value={guardianName} onChange={e => setGuardianName(e.target.value)}
                className="h-8 text-xs" placeholder="Guardian / attendant name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Referred By</Label>
              <Input value={referredBy} onChange={e => setReferredBy(e.target.value)}
                className="h-8 text-xs" placeholder="Referring doctor" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Organisation</Label>
              <Input value={organisation} onChange={e => setOrganisation(e.target.value)}
                className="h-8 text-xs" />
            </div>
          </div>

          {/* Row 3: Vendor | Vendor Bill No | Remarks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Vendor</Label>
              <div className="flex gap-1.5">
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                    <SelectValue placeholder="— None —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {vendors.map(v => (
                      <SelectItem key={v._id} value={v._id}>
                        {v.name}
                        <span className="ml-2 text-gray-400 text-[10px] font-mono">[{v.code}]</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => setShowAddVendor(true)}
                  title="Add new vendor"
                  className="h-8 w-8 shrink-0 flex items-center justify-center border rounded-md text-gray-500 hover:bg-gray-50 hover:text-green-600 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Vendor Bill No</Label>
              <Input value={vendorBillNo} onChange={e => setVendorBillNo(e.target.value)}
                className="h-8 text-xs" placeholder="Bill / invoice number" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Remarks</Label>
              <Input value={remarks} onChange={e => setRemarks(e.target.value)}
                className="h-8 text-xs" placeholder="Optional remarks" />
            </div>
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Investigation Items
              </span>
              <Button type="button" size="sm" variant="outline"
                className="h-7 text-xs gap-1" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" /> Add Row
              </Button>
            </div>
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-600">
                    <th className="px-2 py-2 text-center font-medium w-8">#</th>
                    <th className="px-2 py-2 text-left font-medium w-16">Code</th>
                    <th className="px-2 py-2 text-left font-medium">Description</th>
                    <th className="px-2 py-2 text-right font-medium w-24">Amount (₹)</th>
                    <th className="px-2 py-2 text-left font-medium w-30">Report Date</th>
                    <th className="px-2 py-2 text-left font-medium w-24">Remark</th>
                    <th className="px-2 py-2 text-left font-medium w-28">Category</th>
                    <th className="px-2 py-2 text-left font-medium w-20">Case No</th>
                    <th className="px-2 py-2 text-right font-medium w-24">Net Amt (₹)</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-2 py-1.5 text-gray-400 text-center">{item.slNo}</td>
                      <td className="px-1 py-1.5">
                        <Input value={item.code}
                          onChange={e => setItem(idx, "code", e.target.value)}
                          className="h-7 text-xs px-1.5" placeholder="Code" />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input value={item.description}
                          onChange={e => setItem(idx, "description", e.target.value)}
                          className="h-7 text-xs px-1.5" placeholder="Description *" />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input type="number" value={item.amount} min={0}
                          onChange={e => setItem(idx, "amount", e.target.value)}
                          className="h-7 text-xs px-1.5 text-right" placeholder="0" />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input type="date" value={item.reportDate}
                          onChange={e => setItem(idx, "reportDate", e.target.value)}
                          className="h-7 text-xs px-1.5" />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input value={item.remark}
                          onChange={e => setItem(idx, "remark", e.target.value)}
                          className="h-7 text-xs px-1.5" placeholder="Remark" />
                      </td>
                      <td className="px-1 py-1.5">
                        <select value={item.category}
                          onChange={e => setItem(idx, "category", e.target.value)}
                          className="h-7 w-full border rounded text-xs px-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-ring">
                          <option value="">--</option>
                          {INVESTIGATION_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1.5">
                        <Input value={item.caseNo}
                          onChange={e => setItem(idx, "caseNo", e.target.value)}
                          className="h-7 text-xs px-1.5" placeholder="Case no" />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input type="number" value={item.netAmount} min={0}
                          onChange={e => setItem(idx, "netAmount", e.target.value)}
                          className="h-7 text-xs px-1.5 text-right" placeholder="0" />
                      </td>
                      <td className="px-2 py-1.5">
                        <button type="button" onClick={() => removeItem(idx)}
                          disabled={items.length === 1}
                          className="text-red-400 hover:text-red-600 disabled:opacity-25">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t">
                    <td colSpan={8} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                      Net Amount Total
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-bold text-green-700">
                      ₹{totalAmount.toLocaleString("en-IN")}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-1">
            {editingId && (
              <Button variant="outline" size="sm" onClick={resetForm} className="h-8 text-xs px-4">
                Cancel
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 px-5 gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : editingId ? "Update Requisition" : "Save Requisition"}
            </Button>
          </div>

        </div>
      </div>

      {/* ── Add Vendor Dialog ── */}
      <Dialog open={showAddVendor} onOpenChange={open => {
        setShowAddVendor(open);
        if (!open) { setNewVendorCode(""); setNewVendorName(""); }
      }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Add New Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Vendor Code</Label>
              <Input
                value={newVendorCode}
                onChange={e => setNewVendorCode(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. 13"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendor Name</Label>
              <Input
                value={newVendorName}
                onChange={e => setNewVendorName(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. AROGYA DIAGNOSTIC"
                onKeyDown={e => { if (e.key === "Enter") handleAddVendor(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs h-8"
              onClick={() => setShowAddVendor(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={savingVendor} onClick={handleAddVendor}
              className="text-xs h-8 bg-green-600 hover:bg-green-700">
              {savingVendor ? "Saving…" : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
