import React, { useState, useEffect, useMemo } from "react";
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
import { useConfirm } from "@/components/ui/confirm-dialog";
import ipdService, { ServiceCatalogueEntry, SERVICE_GROUP_META, buildServiceGroups } from "@/services/ipdService";

const UNITS = ["EACH", "DAY", "HOUR", "SESSION", "TEST", "PROCEDURE"];
const NEW_GROUP_VALUE = "__new_group__";

export default function ServiceCatalogueManager() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [items,   setItems]   = useState<ServiceCatalogueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // Filters
  const [filterGroup,  setFilterGroup]  = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [search,       setSearch]       = useState("");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceCatalogueEntry | null>(null);
  const [formGroupCode,    setFormGroupCode]    = useState(SERVICE_GROUP_META[0].code);
  const [formServiceName,  setFormServiceName]  = useState("");
  const [formUnit,         setFormUnit]         = useState(UNITS[0]);
  const [formDefaultCharge,setFormDefaultCharge]= useState("");
  const [formRequiresDoctor,setFormRequiresDoctor]= useState(false);
  const [formIsReferral,   setFormIsReferral]   = useState(false);
  const [formSortOrder,    setFormSortOrder]    = useState("");
  const [formActive,       setFormActive]       = useState(true);
  const [newGroupName,     setNewGroupName]     = useState("");
  const [newGroupCode,     setNewGroupCode]     = useState("");

  const loadAll = () => {
    setLoading(true);
    ipdService.getServiceCatalogue(true)
      .then(r => setItems(r.data.data.items || []))
      .catch(() => toast.error("Failed to load service catalogue"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  // Known groups = static SERVICE_GROUP_META + any groups already present in
  // the catalogue (i.e. previously created via "+ Add New Group" below).
  const allGroups = useMemo(
    () => buildServiceGroups(items).map(g => ({ code: g.code, name: g.name })),
    [items]
  );

  const filtered = items.filter(it => {
    if (filterGroup !== "__all__" && it.serviceGroupCode !== filterGroup) return false;
    if (filterStatus === "active"   && !it.isActive) return false;
    if (filterStatus === "inactive" &&  it.isActive) return false;
    if (search && !it.serviceName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by serviceGroup for display
  const grouped: Record<string, ServiceCatalogueEntry[]> = {};
  for (const item of filtered) {
    if (!grouped[item.serviceGroup]) grouped[item.serviceGroup] = [];
    grouped[item.serviceGroup].push(item);
  }
  const sortedGroups = Object.keys(grouped).sort();

  function groupMeta(code: string) {
    return allGroups.find(m => m.code === code);
  }

  function openAdd(asNewGroup = false) {
    setEditTarget(null);
    setFormGroupCode(asNewGroup ? NEW_GROUP_VALUE : (allGroups[0]?.code ?? SERVICE_GROUP_META[0].code));
    setFormServiceName("");
    setFormUnit(UNITS[0]);
    setFormDefaultCharge("");
    setFormRequiresDoctor(false);
    setFormIsReferral(false);
    setFormSortOrder("");
    setFormActive(true);
    setNewGroupName("");
    setNewGroupCode("");
    setDialogOpen(true);
  }

  function openEdit(item: ServiceCatalogueEntry) {
    setEditTarget(item);
    setFormGroupCode(item.serviceGroupCode);
    setFormServiceName(item.serviceName);
    setFormUnit(item.unit || UNITS[0]);
    setFormDefaultCharge(item.defaultCharge > 0 ? String(item.defaultCharge) : "");
    setFormRequiresDoctor(item.requiresDoctor);
    setFormIsReferral(item.isReferral);
    setFormSortOrder(item.sortOrder > 0 ? String(item.sortOrder) : "");
    setFormActive(item.isActive);
    setNewGroupName("");
    setNewGroupCode("");
    setDialogOpen(true);
  }

  const isNewGroup = formGroupCode === NEW_GROUP_VALUE;

  async function handleSave() {
    if (!formServiceName.trim()) return toast.error("Service name is required");
    let meta: { code: string; name: string } | undefined;
    if (isNewGroup) {
      if (!newGroupName.trim()) return toast.error("Enter a name for the new group");
      if (!newGroupCode.trim()) return toast.error("Enter a short code for the new group");
      meta = { code: newGroupCode.trim().toUpperCase(), name: newGroupName.trim().toUpperCase() };
      if (allGroups.some(g => g.code === meta!.code)) return toast.error("A group with this code already exists");
    } else {
      meta = groupMeta(formGroupCode);
    }
    if (!meta) return toast.error("Select a service group");

    const payload = {
      serviceGroup:     meta.name,
      serviceGroupCode: meta.code,
      serviceName:      formServiceName.trim().toUpperCase(),
      unit:             formUnit,
      defaultCharge:    Number(formDefaultCharge) || 0,
      requiresDoctor:   formRequiresDoctor,
      isReferral:       formIsReferral,
      sortOrder:        Number(formSortOrder) || 0,
      isActive:         formActive,
    };

    if (!(await confirm({
      title: editTarget ? "Update service?" : "Add service?",
      description: editTarget
        ? "This will update the service in the catalogue."
        : "This will add a new service to the catalogue, available for billing immediately.",
      confirmText: editTarget ? "Yes, update" : "Yes, add",
    }))) return;
    setSaving(true);
    try {
      if (editTarget) {
        await ipdService.updateServiceCatalogueItem(editTarget._id, payload);
        toast.success("Service updated");
      } else {
        await ipdService.createServiceCatalogueItem(payload);
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

  async function handleDelete(item: ServiceCatalogueEntry) {
    if (!(await confirm({
      title: "Delete service?",
      description: `"${item.serviceName}" will be permanently deleted from the catalogue.`,
      confirmText: "Yes, delete",
      destructive: true,
    }))) return;
    try {
      await ipdService.deleteServiceCatalogueItem(item._id);
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
          <h1 className="text-xl font-bold text-gray-800">Service Catalogue</h1>
          <p className="text-xs text-gray-500">
            Services available for IPD billing — {items.length} total services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => openAdd(true)} variant="outline"
            className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 gap-1.5">
            <Plus className="h-4 w-4" /> Add Group
          </Button>
          <Button onClick={() => openAdd(false)} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 gap-1.5">
            <Plus className="h-4 w-4" /> Add Service
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search service name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs w-52"
        />
        <Select value={filterGroup} onValueChange={setFilterGroup}>
          <SelectTrigger className="h-8 text-xs w-48">
            <SelectValue placeholder="All Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Groups</SelectItem>
            {allGroups.map(m => (
              <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>
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
        <span className="text-xs text-gray-400">{filtered.length} services</span>
      </div>

      {/* Table grouped by service group */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : sortedGroups.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm border rounded-md bg-white">
          No services found
        </div>
      ) : (
        <div className="border rounded-md bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                <th className="px-3 py-2.5 text-left font-medium">Service Name</th>
                <th className="px-3 py-2.5 text-left font-medium w-24">Unit</th>
                <th className="px-3 py-2.5 text-right font-medium w-28">Default Charge (₹)</th>
                <th className="px-3 py-2.5 text-center font-medium w-24">Doctor?</th>
                <th className="px-3 py-2.5 text-center font-medium w-24">Referral?</th>
                <th className="px-3 py-2.5 text-center font-medium w-20">Status</th>
                <th className="px-3 py-2.5 text-center font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map(grp => (
                <React.Fragment key={grp}>
                  <tr className="bg-gray-50 border-b border-t">
                    <td colSpan={7} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      {grp} — {grouped[grp].length} services
                    </td>
                  </tr>
                  {grouped[grp].map(item => (
                    <tr key={item._id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{item.serviceName}</td>
                      <td className="px-3 py-2 text-gray-500">{item.unit || "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">
                        {item.defaultCharge > 0 ? `₹${item.defaultCharge}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {item.requiresDoctor ? <Badge className="text-[10px] bg-blue-50 text-blue-700">Yes</Badge> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {item.isReferral ? <Badge className="text-[10px] bg-purple-50 text-purple-700">Yes</Badge> : <span className="text-gray-300">—</span>}
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
              {editTarget ? "Edit Service" : isNewGroup ? "Add Group" : "Add Service"}
            </DialogTitle>
            {!editTarget && isNewGroup && (
              <p className="text-[11px] text-gray-500">
                A group is created together with its first service — fill in both below.
              </p>
            )}
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Service Group *</Label>
              <Select value={formGroupCode} onValueChange={setFormGroupCode} disabled={!!editTarget}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allGroups.map(m => (
                    <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>
                  ))}
                  {!editTarget && <SelectItem value={NEW_GROUP_VALUE}>+ Add New Group…</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            {isNewGroup && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">New Group Name *</Label>
                  <Input
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="e.g. AMBULANCE"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Group Code *</Label>
                  <Input
                    value={newGroupCode}
                    onChange={e => setNewGroupCode(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="e.g. 40"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Service Name *</Label>
              <Input
                value={formServiceName}
                onChange={e => setFormServiceName(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. INITIAL MANAGEMENT CHARGES"
                autoFocus={!editTarget}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Default Charge (₹)</Label>
                <Input
                  type="number"
                  value={formDefaultCharge}
                  onChange={e => setFormDefaultCharge(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="0"
                  min={0}
                />
              </div>
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
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formRequiresDoctor}
                  onChange={e => setFormRequiresDoctor(e.target.checked)}
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="text-xs text-gray-600">Requires Doctor</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsReferral}
                  onChange={e => setFormIsReferral(e.target.checked)}
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="text-xs text-gray-600">Referral Service</span>
              </label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs h-8"
              onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={saving} onClick={handleSave}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700">
              {saving ? "Saving…" : editTarget ? "Update" : isNewGroup ? "Add Group" : "Add Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
