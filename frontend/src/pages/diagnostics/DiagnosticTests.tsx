import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import diagnosticsService, { DIAGNOSTIC_DEPARTMENTS, type DiagnosticTestItem } from "@/services/diagnosticsService";

const ALL = "__all__";
const NONE = "__none__";

export default function DiagnosticTests() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [tests, setTests] = useState<DiagnosticTestItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState("");
  const [deptFilter, setDeptFilter] = useState(ALL);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DiagnosticTestItem | null>(null);
  const [formName,      setFormName]      = useState("");
  const [formDept,      setFormDept]      = useState(NONE);
  const [formCharge,    setFormCharge]    = useState("");
  const [formSortOrder, setFormSortOrder] = useState("");
  const [formActive,    setFormActive]    = useState(true);

  const loadAll = () => {
    setLoading(true);
    diagnosticsService.getTests(true)
      .then(r => setTests(r.data.data.tests || []))
      .catch(() => toast.error("Failed to load tests"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const filtered = tests.filter(s =>
    (!search || s.testName.toLowerCase().includes(search.toLowerCase())) &&
    (deptFilter === ALL || (s.department || "") === (deptFilter === NONE ? "" : deptFilter))
  );

  // Known departments plus any already used in the catalogue.
  const departments = Array.from(new Set([...DIAGNOSTIC_DEPARTMENTS, ...tests.map(t => t.department).filter(Boolean)]));

  function openAdd() {
    setEditTarget(null);
    setFormName("");
    setFormDept(NONE);
    setFormCharge("");
    setFormSortOrder("");
    setFormActive(true);
    setDialogOpen(true);
  }

  function openEdit(item: DiagnosticTestItem) {
    setEditTarget(item);
    setFormName(item.testName);
    setFormDept(item.department || NONE);
    setFormCharge(item.charge > 0 ? String(item.charge) : "");
    setFormSortOrder(item.sortOrder ? String(item.sortOrder) : "");
    setFormActive(item.isActive);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) return toast.error("Test name is required");

    const payload = {
      testName: formName.trim().toUpperCase(),
      department:  formDept === NONE ? "" : formDept,
      charge:      Number(formCharge) || 0,
      sortOrder:   Number(formSortOrder) || 0,
      isActive:    formActive,
    };

    if (!(await confirm({
      title: editTarget ? "Update test?" : "Add test?",
      description: editTarget
        ? "This will update the test in the catalogue."
        : "This will add a new test to the catalogue.",
      confirmText: editTarget ? "Yes, update" : "Yes, add",
    }))) return;

    setSaving(true);
    try {
      if (editTarget) {
        await diagnosticsService.updateTest(editTarget._id, payload);
        toast.success("Test updated");
      } else {
        await diagnosticsService.createTest(payload);
        toast.success("Test added");
      }
      setDialogOpen(false);
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: DiagnosticTestItem) {
    if (!(await confirm({
      title: "Delete test?",
      description: `"${item.testName}" will be permanently deleted from the catalogue.`,
      confirmText: "Yes, delete",
      destructive: true,
    }))) return;
    try {
      await diagnosticsService.deleteTest(item._id);
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
          <h1 className="text-xl font-bold text-gray-800">Test Catalogue</h1>
          <p className="text-xs text-gray-500">
            Tests used in diagnostics bills — {tests.length} total tests
          </p>
        </div>
        <Button onClick={openAdd} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 gap-1.5">
          <Plus className="h-4 w-4" /> Add Test
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search test name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs w-52"
        />
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            <SelectItem value={NONE}>No department</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400">{filtered.length} tests</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm border rounded-md bg-white">
          No tests found
        </div>
      ) : (
        <div className="border rounded-md bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                <th className="px-3 py-2.5 text-left font-medium">Test Name</th>
                <th className="px-3 py-2.5 text-left font-medium w-36">Department</th>
                <th className="px-3 py-2.5 text-right font-medium w-28">Rate (₹)</th>
                <th className="px-3 py-2.5 text-center font-medium w-20">Status</th>
                <th className="px-3 py-2.5 text-center font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item._id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{item.testName}</td>
                  <td className="px-3 py-2 text-gray-600">{item.department || <span className="text-gray-300">—</span>}</td>
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
              {editTarget ? "Edit Test" : "Add Test"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Test Name *</Label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. USG WHOLE ABDOMEN"
                autoFocus={!editTarget}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Department</Label>
              <Select value={formDept} onValueChange={setFormDept}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  <SelectItem value={NONE}>— None —</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Rate (₹)</Label>
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
              {saving ? "Saving…" : editTarget ? "Update" : "Add Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
