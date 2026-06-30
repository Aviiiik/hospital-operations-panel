import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import ipdService, { InvestigationVendor } from "@/services/ipdService";

export default function InvestigationVendors() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [vendors,  setVendors]  = useState<InvestigationVendor[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [saving,   setSaving]   = useState(false);

  // Add/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InvestigationVendor | null>(null);
  const [formCode,   setFormCode]   = useState("");
  const [formName,   setFormName]   = useState("");
  const [formActive, setFormActive] = useState(true);

  const load = () => {
    setLoading(true);
    ipdService.getVendors(true)
      .then(res => setVendors(res.data.data.vendors || []))
      .catch(() => toast.error("Failed to load vendors"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.code.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditTarget(null);
    setFormCode("");
    setFormName("");
    setFormActive(true);
    setDialogOpen(true);
  }

  function openEdit(v: InvestigationVendor) {
    setEditTarget(v);
    setFormCode(v.code);
    setFormName(v.name);
    setFormActive(v.isActive);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formCode.trim() || !formName.trim())
      return toast.error("Code and name are required");
    if (!(await confirm({
      title: editTarget ? "Update vendor?" : "Add vendor?",
      description: editTarget
        ? "This will update the vendor details."
        : "This will add a new vendor.",
      confirmText: editTarget ? "Yes, update" : "Yes, add",
    }))) return;
    setSaving(true);
    try {
      if (editTarget) {
        await ipdService.updateVendor(editTarget._id, {
          code: formCode.trim().toUpperCase(),
          name: formName.trim().toUpperCase(),
          isActive: formActive,
        });
        toast.success("Vendor updated");
      } else {
        await ipdService.createVendor({
          code: formCode.trim().toUpperCase(),
          name: formName.trim().toUpperCase(),
          isActive: formActive,
        });
        toast.success("Vendor added");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(v: InvestigationVendor) {
    if (!(await confirm({
      title: "Delete vendor?",
      description: `Vendor "${v.name}" will be permanently deleted.`,
      confirmText: "Yes, delete",
      destructive: true,
    }))) return;
    try {
      await ipdService.deleteVendor(v._id);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Investigation Vendors</h1>
          <p className="text-xs text-gray-500">Manage external diagnostic labs and vendors</p>
        </div>
        <Button onClick={openAdd} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 gap-1.5">
          <Plus className="h-4 w-4" /> Add Vendor
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by name or code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs max-w-xs"
        />
        <span className="text-xs text-gray-400">{filtered.length} vendors</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : (
        <div className="border rounded-md bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                <th className="px-4 py-2.5 text-left font-medium w-24">Code</th>
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-center font-medium w-20">Status</th>
                <th className="px-4 py-2.5 text-center font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No vendors found
                  </td>
                </tr>
              ) : (
                filtered.map(v => (
                  <tr key={v._id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono font-semibold text-gray-700">{v.code}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{v.name}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={v.isActive ? "default" : "secondary"} className="text-[10px]">
                        {v.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => openEdit(v)}
                          className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(v)}
                          className="p-1 text-red-400 hover:bg-red-50 rounded" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editTarget ? "Edit Vendor" : "Add Vendor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Vendor Code</Label>
              <Input
                value={formCode}
                onChange={e => setFormCode(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. AROGYA"
                autoFocus={!editTarget}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendor Name</Label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. AROGYA DIAGNOSTIC"
                onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
              />
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
              {saving ? "Saving…" : editTarget ? "Update" : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
