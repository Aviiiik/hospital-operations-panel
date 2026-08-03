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
import opdService, { OpdServiceItem } from "@/services/opdService";

export default function OpdServices() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [services, setServices] = useState<OpdServiceItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OpdServiceItem | null>(null);
  const [formName,      setFormName]      = useState("");
  const [formCharge,    setFormCharge]    = useState("");
  const [formSortOrder, setFormSortOrder] = useState("");
  const [formActive,    setFormActive]    = useState(true);

  const loadAll = () => {
    setLoading(true);
    opdService.getOpdServices(true)
      .then(r => setServices(r.data.data.services || []))
      .catch(() => toast.error("Failed to load services"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const filtered = services.filter(s =>
    !search || s.serviceName.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditTarget(null);
    setFormName("");
    setFormCharge("");
    setFormSortOrder("");
    setFormActive(true);
    setDialogOpen(true);
  }

  function openEdit(item: OpdServiceItem) {
    setEditTarget(item);
    setFormName(item.serviceName);
    setFormCharge(item.charge > 0 ? String(item.charge) : "");
    setFormSortOrder(item.sortOrder ? String(item.sortOrder) : "");
    setFormActive(item.isActive);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) return toast.error("Service name is required");

    const payload = {
      serviceName: formName.trim().toUpperCase(),
      charge:      Number(formCharge) || 0,
      sortOrder:   Number(formSortOrder) || 0,
      isActive:    formActive,
    };

    if (!(await confirm({
      title: editTarget ? "Update service?" : "Add service?",
      description: editTarget
        ? "This will update the OPD service in the catalogue."
        : "This will add a new OPD service to the catalogue.",
      confirmText: editTarget ? "Yes, update" : "Yes, add",
    }))) return;

    setSaving(true);
    try {
      if (editTarget) {
        await opdService.updateOpdService(editTarget._id, payload);
        toast.success("Service updated");
      } else {
        await opdService.createOpdService(payload);
        toast.success("Service added");
      }
      setDialogOpen(false);
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: OpdServiceItem) {
    if (!(await confirm({
      title: "Delete service?",
      description: `"${item.serviceName}" will be permanently deleted from the catalogue.`,
      confirmText: "Yes, delete",
      destructive: true,
    }))) return;
    try {
      await opdService.deleteOpdService(item._id);
      toast.success("Deleted");
      loadAll();
    } catch {
      toast.error("Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">OPD Services</h1>
          <p className="text-xs text-gray-500">
            Service catalogue used in OPD bookings — {services.length} total services
          </p>
        </div>
        <Button onClick={openAdd} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 gap-1.5">
          <Plus className="h-4 w-4" /> Add Service
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search service name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs w-52"
        />
        <span className="text-xs text-gray-400">{filtered.length} services</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm border rounded-md bg-white">
          No services found
        </div>
      ) : (
        <div className="border rounded-md bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                <th className="px-3 py-2.5 text-left font-medium">Service Name</th>
                <th className="px-3 py-2.5 text-right font-medium w-28">Charge (₹)</th>
                <th className="px-3 py-2.5 text-center font-medium w-20">Status</th>
                <th className="px-3 py-2.5 text-center font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item._id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{item.serviceName}</td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-800">
                    {item.charge > 0 ? `₹${item.charge}` : <span className="text-gray-300">—</span>}
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
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editTarget ? "Edit OPD Service" : "Add OPD Service"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Service Name *</Label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. IV INJECTION"
                autoFocus={!editTarget}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Charge (₹)</Label>
                <Input
                  type="number"
                  value={formCharge}
                  onChange={e => setFormCharge(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="0"
                  min={0}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sort Order</Label>
                <Input
                  type="number"
                  value={formSortOrder}
                  onChange={e => setFormSortOrder(e.target.value)}
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
              {saving ? "Saving…" : editTarget ? "Update" : "Add Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
