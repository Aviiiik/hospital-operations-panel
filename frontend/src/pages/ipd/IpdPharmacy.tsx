import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Pill, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import ipdService from "@/services/ipdService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PharmItem {
  itemName: string;
  package: string;
  batchNo: string;
  expiryDate: string;
  mrp: string;
  pQty: string;
  unit: string;
  qty: string;
  discount: string;
  discountType: "%" | "₹";
  totalAmount: number;
  netAmount: number;
}

interface PharmBill {
  _id: string;
  billNo: string;
  billDate: string;
  referredBy: string;
  vendor: string;
  vendorBillNo: string;
  items: PharmItem[];
  totalAmount: number;
  netAmount: number;
}

interface Medicine {
  _id: string;
  itemCode: string;
  termName: string;
  unitName: string;
  packingPower: string;
  boxNo: string;
  mrp: number;
  isActive: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PACKAGES = ["TABLET", "CAPSULE", "SYRUP", "INJECTION", "CREAM", "OINTMENT",
  "DROPS", "SACHET", "POWDER", "LOTION", "GEL", "PATCH", "INHALER", "OTHER"];

const BLANK_ITEM: PharmItem = {
  itemName: "", package: "", batchNo: "", expiryDate: "",
  mrp: "", pQty: "1", unit: "", qty: "1", discount: "0", discountType: "%",
  totalAmount: 0, netAmount: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}
function fmtDate(d: string | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function calcItem(it: PharmItem): PharmItem {
  const mrp  = parseFloat(it.mrp)  || 0;
  const qty  = parseFloat(it.qty)  || 0;
  const disc = parseFloat(it.discount) || 0;
  const total = mrp * qty;
  const net = it.discountType === "₹"
    ? Math.max(0, total - disc)
    : total - (total * disc / 100);
  return { ...it, totalAmount: total, netAmount: Math.max(0, net) };
}

// ─── Medicine dropdown with search ───────────────────────────────────────────

function MedicineSelect({
  value, onSelect, medicines,
}: { value: string; onSelect: (med: Medicine) => void; medicines: Medicine[] }) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos]       = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const filtered = search.trim()
    ? medicines.filter(m => m.termName.toLowerCase().includes(search.toLowerCase()))
    : medicines;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: Math.max(r.width, 240) });
    }
    setSearch("");
    setOpen(o => !o);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className="h-9 w-full border rounded text-sm px-2 text-left bg-white flex items-center justify-between gap-1 hover:border-gray-400"
        onClick={handleToggle}
      >
        <span className={value ? "text-gray-900 truncate" : "text-gray-400"}>
          {value || "Select medicine…"}
        </span>
        <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div
          ref={dropRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border rounded shadow-lg"
        >
          <div className="p-1.5 border-b">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search medicine…"
              className="w-full text-xs px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">No medicines found</div>
            ) : filtered.map(m => (
              <div
                key={m._id}
                className="px-3 py-1.5 text-xs hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                onMouseDown={() => { onSelect(m); setOpen(false); }}
              >
                <div className="font-medium">{m.termName}</div>
                <div className="text-gray-400 text-[10px] flex gap-3 mt-0.5">
                  {m.packingPower && <span>{m.packingPower}</span>}
                  {m.unitName && <span>{m.unitName}</span>}
                  {m.mrp > 0 && <span className="text-indigo-500">MRP ₹{m.mrp}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IpdPharmacy() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();

  const [patient,   setPatient]   = useState<any>(null);
  const [bills,     setBills]     = useState<PharmBill[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());
  const [showForm,  setShowForm]  = useState(false);
  const [editBillId, setEditBillId] = useState<string | null>(null);

  // New bill form
  const [billDate,     setBillDate]     = useState(todayStr());
  const [referredBy,   setReferredBy]   = useState("");
  const [vendor,       setVendor]       = useState("");
  const [vendorBillNo, setVendorBillNo] = useState("");
  const [items,        setItems]        = useState<PharmItem[]>([{ ...BLANK_ITEM }]);

  // Add medicine modal
  const [showMedModal, setShowMedModal] = useState(false);
  const [medForm,      setMedForm]      = useState({
    termName: "", unitName: "", packingPower: "", boxNo: "", mrp: "", isActive: true,
  });
  const [savingMed, setSavingMed] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      ipdService.getPatient(id),
      ipdService.getPharmacyBills(id),
      ipdService.getMedicines(true),
    ]).then(([pr, br, mr]) => {
      const loadedBills: PharmBill[] = br.data.data.bills || [];
      setPatient(pr.data.data);
      setBills(loadedBills);
      setExpanded(new Set(loadedBills.map(b => b._id)));
      setMedicines(mr.data.data.medicines || []);
    }).catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleExpand = (billId: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(billId) ? n.delete(billId) : n.add(billId);
      return n;
    });
  };

  const resetForm = () => {
    setBillDate(todayStr());
    setReferredBy("");
    setVendor("");
    setVendorBillNo("");
    setItems([{ ...BLANK_ITEM }]);
    setEditBillId(null);
    setShowForm(false);
  };

  const openEditBill = (bill: PharmBill) => {
    setBillDate(new Date(bill.billDate).toISOString().slice(0, 10));
    setReferredBy(bill.referredBy || "");
    setVendor(bill.vendor || "");
    setVendorBillNo(bill.vendorBillNo || "");
    setItems(bill.items.map(it => ({
      ...it, mrp: String(it.mrp), qty: String(it.qty),
      pQty: String(it.pQty || 1), discount: String(it.discount || 0),
      discountType: (it as any).discountType || "%",
    })));
    setEditBillId(bill._id);
    setShowForm(true);
  };

  const setItem = (idx: number, field: keyof PharmItem, val: string) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      return calcItem({ ...it, [field]: val });
    }));
  };

  const handleMedicineSelect = (idx: number, med: Medicine) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      return calcItem({ ...it, itemName: med.termName, mrp: String(med.mrp || ""), unit: med.unitName || "" });
    }));
  };

  const addItem  = () => setItems(prev => [...prev, { ...BLANK_ITEM }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!vendorBillNo.trim()) return toast.error("Bill No is required");
    if (items.some(it => !it.itemName.trim())) return toast.error("All items need a medicine name");
    if (!(await confirm({
      title: editBillId ? "Update pharmacy bill?" : "Save pharmacy bill?",
      description: editBillId
        ? "This will update the existing pharmacy bill."
        : "This will save a new pharmacy bill for this patient.",
      confirmText: editBillId ? "Yes, update" : "Yes, save",
    }))) return;
    setSaving(true);
    try {
      const payload = { billDate, referredBy, vendor, vendorBillNo, items };
      if (editBillId) {
        await ipdService.updatePharmacyBill(editBillId, payload);
        toast.success("Bill updated");
      } else {
        await ipdService.createPharmacyBill(id!, payload);
        toast.success("Pharmacy bill saved");
      }
      const br = await ipdService.getPharmacyBills(id!);
      const refreshed: PharmBill[] = br.data.data.bills || [];
      setBills(refreshed);
      setExpanded(new Set(refreshed.map(b => b._id)));
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (billId: string) => {
    if (!(await confirm({
      title: "Delete pharmacy bill?",
      description: "This pharmacy bill will be permanently deleted.",
      confirmText: "Yes, delete",
      destructive: true,
    }))) return;
    try {
      await ipdService.deletePharmacyBill(billId);
      setBills(prev => prev.filter(b => b._id !== billId));
      toast.success("Bill deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const handleSaveMedicine = async () => {
    if (!medForm.termName.trim()) return toast.error("Medicine name is required");
    setSavingMed(true);
    try {
      const med = await ipdService.createMedicine({ ...medForm, mrp: parseFloat(medForm.mrp) || 0 });
      setMedicines(prev => [...prev, med.data.data]);
      setShowMedModal(false);
      setMedForm({ termName: "", unitName: "", packingPower: "", boxNo: "", mrp: "", isActive: true });
      toast.success("Medicine added to catalog");
    } catch { toast.error("Failed to add medicine"); }
    finally { setSavingMed(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  if (!patient) return <div className="flex items-center justify-center h-64 text-red-500">Patient not found</div>;

  const totalPharmCharge = bills.reduce((s, b) => s + (b.netAmount || 0), 0);

  const billItems = items;
  const formTotal = billItems.reduce((s, it) => s + it.totalAmount, 0);
  const formNet   = billItems.reduce((s, it) => s + it.netAmount, 0);

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/ipd/edit/${id}`)} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Pharmacy</h1>
            <p className="text-gray-500 text-sm font-mono">{patient.admissionId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
            onClick={() => setShowMedModal(true)}>
            <Plus className="h-4 w-4" /> Add Medicine to Catalog
          </Button>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700 gap-2">
              <Plus className="h-4 w-4" /> New Bill
            </Button>
          )}
        </div>
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
              <span className="text-xs text-gray-500 block">Admission ID</span>
              <span className="font-mono font-semibold">{patient.admissionId}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Admitted</span>
              <span>{fmtDate(patient.admissionDate)}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Attending Doctor(s)</span>
              <span>{patient.doctors?.map((d: any) => d.doctorName).join(", ") || "—"}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Total Pharmacy Charge</span>
              <span className="font-bold text-green-700">{fmt(totalPharmCharge)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New / Edit Bill Form */}
      {showForm && (
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="h-4 w-4 text-green-600" />
              {editBillId ? "Edit Pharmacy Bill" : "New Pharmacy Bill"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bill header */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Bill Date</Label>
                <Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Referred By</Label>
                <Input value={referredBy} onChange={e => setReferredBy(e.target.value)} className="h-9 text-sm" placeholder="Doctor / ward" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vendor / Pharmacy</Label>
                <Input value={vendor} onChange={e => setVendor(e.target.value)} className="h-9 text-sm" placeholder="Pharmacy name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bill No <span className="text-red-500">*</span></Label>
                <Input value={vendorBillNo} onChange={e => setVendorBillNo(e.target.value)} className="h-9 text-sm" placeholder="Bill / invoice no" />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <span className="text-sm font-medium text-gray-700">Items</span>
              {items.map((it, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3 bg-gray-50/50">
                  {/* Row 1: Item name + Package + Unit + delete */}
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-5 space-y-1">
                      <Label className="text-xs">Item Name <span className="text-red-500">*</span></Label>
                      <MedicineSelect
                        value={it.itemName}
                        onSelect={med => handleMedicineSelect(idx, med)}
                        medicines={medicines}
                      />
                    </div>
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">Package</Label>
                      <select
                        value={it.package}
                        onChange={e => setItem(idx, "package", e.target.value)}
                        className="h-9 w-full border rounded text-sm px-2 bg-white"
                      >
                        <option value="">—</option>
                        {PACKAGES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Input value={it.unit} onChange={e => setItem(idx, "unit", e.target.value)} className="h-9 text-sm" placeholder="mg/ml" />
                    </div>
                    <div className="col-span-1 flex justify-end pb-0.5">
                      {items.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Row 2: MRP, P.Qty, Qty, Batch, Expiry */}
                  <div className="grid grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">MRP (₹)</Label>
                      <Input type="number" value={it.mrp} onChange={e => setItem(idx, "mrp", e.target.value)} className="h-9 text-sm text-right" placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Packing Qty</Label>
                      <Input type="number" value={it.pQty} onChange={e => setItem(idx, "pQty", e.target.value)} className="h-9 text-sm text-center" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input type="number" value={it.qty} onChange={e => setItem(idx, "qty", e.target.value)} className="h-9 text-sm text-center" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Batch No</Label>
                      <Input value={it.batchNo} onChange={e => setItem(idx, "batchNo", e.target.value)} className="h-9 text-sm" placeholder="Batch" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Expiry Date</Label>
                      <Input type="month" value={it.expiryDate} onChange={e => setItem(idx, "expiryDate", e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>

                  {/* Row 3: Totals */}
                  <div className="flex items-center justify-end gap-6 pt-2 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      Total: <span className="font-semibold text-gray-700">{fmt(it.totalAmount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-500 shrink-0">Discount</Label>
                      <Input
                        type="number"
                        value={it.discount}
                        onChange={e => setItem(idx, "discount", e.target.value)}
                        className="h-8 text-sm text-center w-20"
                        placeholder="0"
                      />
                      <button
                        type="button"
                        onClick={() => setItem(idx, "discountType", it.discountType === "%" ? "₹" : "%")}
                        className="h-8 w-10 shrink-0 rounded border border-gray-300 text-sm font-semibold hover:bg-gray-100 bg-white"
                      >
                        {it.discountType}
                      </button>
                    </div>
                    <div className="text-sm font-medium">
                      Net: <span className="font-bold text-green-700 text-base">{fmt(it.netAmount)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Item + Totals row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 h-8 text-xs border-green-300 text-green-700">
                <Plus className="h-3 w-3" /> Add Item
              </Button>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-500">Total: <span className="font-semibold">{fmt(formTotal)}</span></span>
                <span className="font-bold text-green-700">Net: <span className="text-lg">{fmt(formNet)}</span></span>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? "Saving…" : editBillId ? "Update Bill" : "Save Bill"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bills list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pharmacy Bills</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {bills.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400">
              <Pill className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No pharmacy bills recorded.</p>
            </div>
          ) : (
            bills.map(bill => (
              <div key={bill._id} className="border-t first:border-t-0">
                {/* Bill header row */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpand(bill._id)}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="font-mono text-sm font-semibold">{bill.vendorBillNo || "—"}</span>
                      <span className="text-xs text-gray-400 ml-2">{fmtDate(bill.billDate)}</span>
                    </div>
                    {bill.vendor && <Badge variant="outline" className="text-xs">{bill.vendor}</Badge>}
                    {bill.referredBy && <span className="text-xs text-gray-500">Ref: {bill.referredBy}</span>}
                    <span className="text-xs text-gray-400">{bill.items.length} item{bill.items.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-green-700">{fmt(bill.netAmount)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-400 hover:text-indigo-600"
                      onClick={e => { e.stopPropagation(); openEditBill(bill); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
                      onClick={e => { e.stopPropagation(); handleDelete(bill._id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {expanded.has(bill._id)
                      ? <ChevronUp className="h-4 w-4 text-gray-400" />
                      : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded items */}
                {expanded.has(bill._id) && (
                  <div className="border-t bg-gray-50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 uppercase border-b">
                          <th className="px-4 py-1.5 text-left font-medium">Item Name</th>
                          <th className="px-4 py-1.5 text-left font-medium">Package</th>
                          <th className="px-4 py-1.5 text-left font-medium">Batch</th>
                          <th className="px-4 py-1.5 text-left font-medium">Expiry</th>
                          <th className="px-4 py-1.5 text-right font-medium">MRP</th>
                          <th className="px-4 py-1.5 text-center font-medium">Qty</th>
                          <th className="px-4 py-1.5 text-center font-medium">Discount</th>
                          <th className="px-4 py-1.5 text-right font-medium">Net Amt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bill.items.map((it, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-4 py-1.5 font-medium">{it.itemName}</td>
                            <td className="px-4 py-1.5 text-gray-500">{it.package || "—"}</td>
                            <td className="px-4 py-1.5 text-gray-500">{it.batchNo || "—"}</td>
                            <td className="px-4 py-1.5 text-gray-500">{it.expiryDate || "—"}</td>
                            <td className="px-4 py-1.5 text-right">{fmt(parseFloat(it.mrp))}</td>
                            <td className="px-4 py-1.5 text-center">{it.qty}</td>
                            <td className="px-4 py-1.5 text-center">{it.discount || 0}{(it as any).discountType || "%"}</td>
                            <td className="px-4 py-1.5 text-right font-semibold text-green-700">{fmt(it.netAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Total footer */}
      {bills.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-3 pb-3 flex items-center justify-between">
            <span className="font-semibold text-green-800">Total Pharmacy Charge ({bills.length} bill{bills.length !== 1 ? "s" : ""})</span>
            <span className="text-2xl font-bold text-green-700">{fmt(totalPharmCharge)}</span>
          </CardContent>
        </Card>
      )}

      {/* Add Medicine to Catalog Modal */}
      <Dialog open={showMedModal} onOpenChange={setShowMedModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-4 w-4" /> Add New Medicine to Catalog
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Medicine / Term Name <span className="text-red-500">*</span></Label>
              <Input
                value={medForm.termName}
                onChange={e => setMedForm(f => ({ ...f, termName: e.target.value }))}
                placeholder="e.g. Paracetamol"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Unit Name</Label>
                <Input
                  value={medForm.unitName}
                  onChange={e => setMedForm(f => ({ ...f, unitName: e.target.value }))}
                  placeholder="e.g. Tablet"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Packing / Power</Label>
                <Input
                  value={medForm.packingPower}
                  onChange={e => setMedForm(f => ({ ...f, packingPower: e.target.value }))}
                  placeholder="e.g. 500mg"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">MRP (₹)</Label>
                <Input
                  type="number"
                  value={medForm.mrp}
                  onChange={e => setMedForm(f => ({ ...f, mrp: e.target.value }))}
                  placeholder="0.00"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Box No</Label>
                <Input
                  value={medForm.boxNo}
                  onChange={e => setMedForm(f => ({ ...f, boxNo: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={medForm.isActive}
                onChange={e => setMedForm(f => ({ ...f, isActive: e.target.checked }))}
                className="rounded"
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMedModal(false)}>Cancel</Button>
            <Button onClick={handleSaveMedicine} disabled={savingMed} className="bg-purple-600 hover:bg-purple-700">
              {savingMed ? "Saving…" : "Add Medicine"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
