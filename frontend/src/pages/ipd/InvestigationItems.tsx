import React, { useState, useEffect } from "react";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ipdService, { InvestigationItem, InvestigationVendor } from "@/services/ipdService";

const CATEGORIES = [
  "BLOOD", "URINE", "STOOL", "MICROBIOLOGY", "BIOCHEMISTRY",
  "PATHOLOGY", "RADIOLOGY", "CARDIOLOGY", "ENDOSCOPY", "OTHER",
];

const CATEGORY_COLORS: Record<string, string> = {
  BLOOD:        "bg-red-50 text-red-700",
  URINE:        "bg-yellow-50 text-yellow-700",
  STOOL:        "bg-amber-50 text-amber-700",
  MICROBIOLOGY: "bg-purple-50 text-purple-700",
  BIOCHEMISTRY: "bg-blue-50 text-blue-700",
  PATHOLOGY:    "bg-pink-50 text-pink-700",
  RADIOLOGY:    "bg-indigo-50 text-indigo-700",
  CARDIOLOGY:   "bg-rose-50 text-rose-700",
  ENDOSCOPY:    "bg-teal-50 text-teal-700",
  OTHER:        "bg-gray-100 text-gray-600",
};

export default function InvestigationItems() {
  const [items,    setItems]    = useState<InvestigationItem[]>([]);
  const [vendors,  setVendors]  = useState<InvestigationVendor[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Filters
  const [filterVendor,   setFilterVendor]   = useState("__all__");
  const [filterCategory, setFilterCategory] = useState("__all__");
  const [filterStatus,   setFilterStatus]   = useState("__all__");
  const [search,         setSearch]         = useState("");

  // Dialog
  const [dialogOpen,  setDialogOpen]  = useState(false);
  const [editTarget,  setEditTarget]  = useState<InvestigationItem | null>(null);
  const [formSlNo,        setFormSlNo]        = useState("");
  const [formName,        setFormName]        = useState("");
  const [formCategory,    setFormCategory]    = useState(CATEGORIES[0]);
  const [formLabRate,     setFormLabRate]     = useState("");
  const [formPatientRate, setFormPatientRate] = useState("");
  const [formVendorCode,  setFormVendorCode]  = useState("AROGYA");
  const [formActive,      setFormActive]      = useState(true);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      ipdService.getInvestigationItems(undefined, true),
      ipdService.getVendors(true),
    ]).then(([ir, vr]) => {
      setItems(ir.data.data.items || []);
      setVendors(vr.data.data.vendors || []);
    }).catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const filtered = items.filter(it => {
    if (filterVendor !== "__all__" && it.vendorCode !== filterVendor) return false;
    if (filterCategory !== "__all__" && it.category !== filterCategory) return false;
    if (filterStatus === "active"   && !it.isActive) return false;
    if (filterStatus === "inactive" &&  it.isActive) return false;
    if (search && !it.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by category for display
  const grouped: Record<string, InvestigationItem[]> = {};
  for (const item of filtered) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  const sortedCategories = Object.keys(grouped).sort();

  function openAdd() {
    setEditTarget(null);
    setFormSlNo("");
    setFormName("");
    setFormCategory(CATEGORIES[0]);
    setFormLabRate("");
    setFormPatientRate("");
    setFormVendorCode(vendors[0]?.code || "AROGYA");
    setFormActive(true);
    setDialogOpen(true);
  }

  function openEdit(item: InvestigationItem) {
    setEditTarget(item);
    setFormSlNo(item.slNo ? String(item.slNo) : "");
    setFormName(item.name);
    setFormCategory(item.category);
    setFormLabRate(item.labRate > 0 ? String(item.labRate) : "");
    setFormPatientRate(item.patientRate > 0 ? String(item.patientRate) : "");
    setFormVendorCode(item.vendorCode);
    setFormActive(item.isActive);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim())         return toast.error("Name is required");
    if (!formCategory)            return toast.error("Category is required");
    if (!formVendorCode.trim())   return toast.error("Vendor is required");

    const vendorObj = vendors.find(v => v.code === formVendorCode);
    const payload = {
      slNo:        Number(formSlNo) || undefined,
      name:        formName.trim().toUpperCase(),
      category:    formCategory,
      labRate:     Number(formLabRate)     || 0,
      patientRate: Number(formPatientRate) || 0,
      vendorCode:  formVendorCode.trim().toUpperCase(),
      vendorName:  vendorObj?.name || formVendorCode.trim().toUpperCase(),
      isActive:    formActive,
    };

    setSaving(true);
    try {
      if (editTarget) {
        await ipdService.updateInvestigationItem(editTarget._id, payload);
        toast.success("Item updated");
      } else {
        await ipdService.createInvestigationItem(payload);
        toast.success("Item added");
      }
      setDialogOpen(false);
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: InvestigationItem) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await ipdService.deleteInvestigationItem(item._id);
      toast.success("Deleted");
      loadAll();
    } catch {
      toast.error("Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Investigation Items</h1>
          <p className="text-xs text-gray-500">
            Test catalogue by vendor — {items.length} total items
          </p>
        </div>
        <Button onClick={openAdd} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 gap-1.5">
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search test name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs w-52"
        />
        <Select value={filterVendor} onValueChange={setFilterVendor}>
          <SelectTrigger className="h-8 text-xs w-44">
            <SelectValue placeholder="All Vendors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Vendors</SelectItem>
            {vendors.map(v => (
              <SelectItem key={v._id} value={v.code}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Categories</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-32">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400">{filtered.length} items</span>
      </div>

      {/* Table grouped by category */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : sortedCategories.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm border rounded-md bg-white">
          No items found
        </div>
      ) : (
        <div className="border rounded-md bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                <th className="px-3 py-2.5 text-left font-medium w-16">Code</th>
                <th className="px-3 py-2.5 text-left font-medium">Test Name</th>
                <th className="px-3 py-2.5 text-left font-medium w-28">Category</th>
                <th className="px-3 py-2.5 text-left font-medium w-28">Vendor</th>
                <th className="px-3 py-2.5 text-right font-medium w-24">Lab Rate (₹)</th>
                <th className="px-3 py-2.5 text-right font-medium w-28">Patient Rate (₹)</th>
                <th className="px-3 py-2.5 text-center font-medium w-20">Status</th>
                <th className="px-3 py-2.5 text-center font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map(cat => (
                <React.Fragment key={cat}>
                  <tr className="bg-gray-50 border-b border-t">
                    <td colSpan={8}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${CATEGORY_COLORS[cat] || "text-gray-500"}`}>
                      {cat} — {grouped[cat].length} tests
                    </td>
                  </tr>
                  {grouped[cat].map((item) => (
                    <tr key={item._id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-gray-500">{item.slNo ?? "—"}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{item.name}</td>
                      <td className="px-3 py-2">
                        <Badge className={`text-[10px] ${CATEGORY_COLORS[item.category] || "bg-gray-100 text-gray-600"}`}>
                          {item.category}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{item.vendorName || item.vendorCode}</td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {item.labRate > 0 ? `₹${item.labRate}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">
                        {item.patientRate > 0 ? `₹${item.patientRate}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={item.isActive ? "default" : "secondary"} className="text-[10px]">
                          {item.isActive ? "Active" : "Off"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => openEdit(item)}
                            className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(item)}
                            className="p-1 text-red-400 hover:bg-red-50 rounded" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editTarget ? "Edit Investigation Item" : "Add Investigation Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Code (Sl No)</Label>
                <Input
                  type="number"
                  value={formSlNo}
                  onChange={e => setFormSlNo(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. 33"
                  min={1}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Test Name *</Label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. CBC"
                  autoFocus={!editTarget}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category *</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vendor *</Label>
                <Select value={formVendorCode} onValueChange={setFormVendorCode}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(v => (
                      <SelectItem key={v._id} value={v.code}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Lab Rate (₹)</Label>
                <Input
                  type="number"
                  value={formLabRate}
                  onChange={e => setFormLabRate(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="0"
                  min={0}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Patient Rate (₹)</Label>
                <Input
                  type="number"
                  value={formPatientRate}
                  onChange={e => setFormPatientRate(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="0"
                  min={0}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formActive}
                onChange={e => setFormActive(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-xs text-gray-600">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs h-8"
              onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={saving} onClick={handleSave}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700">
              {saving ? "Saving…" : editTarget ? "Update" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
