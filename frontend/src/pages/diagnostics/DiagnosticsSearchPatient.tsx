import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Pencil, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import DatePresetFilter, { type DatePreset, getDateRange } from "@/components/DatePresetFilter";
import ExportExcelButton from "@/components/ExportExcelButton";
import { useAuth } from "@/contexts/AuthContext";
import diagnosticsService, { type DiagnosticPatient } from "@/services/diagnosticsService";
import { printDiagnosticBill } from "@/lib/diagnosticsPrint";

const EMPTY_SEARCH = { name: "", phone: "", billNo: "" };

// One patient = one bill, so each row here already carries its own bill —
// no separate "previous bills" list or "new bill" action is needed.
export default function DiagnosticsSearchPatient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role.toLowerCase() === "admin";

  const [search,   setSearch]   = useState(EMPTY_SEARCH);
  const [preset,   setPreset]   = useState<DatePreset | null>("today");
  const [patients, setPatients] = useState<DiagnosticPatient[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DiagnosticPatient | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  const fetchPatients = async (params: Record<string, string>) => {
    setLoading(true);
    try {
      const res = await diagnosticsService.searchPatients(params);
      setPatients(res.data.data.patients);
      setSearched(true);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const loadToday = () => {
    const { from, to } = getDateRange("today");
    fetchPatients({ from: from.toISOString(), to: to.toISOString() });
  };

  useEffect(() => { loadToday(); }, []);

  // Text search — no date filter; deactivates any preset
  const handleSearch = () => {
    const params = Object.fromEntries(Object.entries(search).filter(([, v]) => v.trim() !== ""));
    if (Object.keys(params).length === 0) return;
    setPreset(null);
    fetchPatients(params);
  };

  // Preset — date filter only; clears text search
  const handlePresetChange = (p: DatePreset, range: { from: Date; to: Date }) => {
    setSearch(EMPTY_SEARCH);
    setPreset(p);
    fetchPatients({ from: range.from.toISOString(), to: range.to.toISOString() });
  };

  const handleClear = () => {
    setSearch(EMPTY_SEARCH);
    setPreset("today");
    loadToday();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await diagnosticsService.deletePatient(deleteTarget._id);
      setPatients(prev => prev.filter(p => p._id !== deleteTarget._id));
      toast.success("Patient deleted successfully");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete patient");
    } finally {
      setDeleting(false);
    }
  };

  const s = (field: keyof typeof EMPTY_SEARCH) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search Patient</h1>
        <p className="text-gray-500 text-sm">Find a diagnostics patient to edit, print, or delete</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Search Patient</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs mb-2 block">Date Filter</Label>
            <DatePresetFilter value={preset} onChange={handlePresetChange} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Patient Name</Label>
              <Input value={search.name} onChange={s("name")} onKeyDown={handleKeyDown} placeholder="Enter name..." className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={search.phone} onChange={s("phone")} onKeyDown={handleKeyDown} placeholder="Mobile number" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bill No</Label>
              <Input value={search.billNo} onChange={s("billNo")} onKeyDown={handleKeyDown} placeholder="e.g. 00001/2026" className="h-9 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClear}>Clear</Button>
            <Button onClick={handleSearch} className="bg-red-600 hover:bg-red-700" disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {searched && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Results <span className="text-gray-400 font-normal text-sm">({patients.length})</span>
            </CardTitle>
            <ExportExcelButton
              filename="diagnostics-patients"
              data={patients.map(p => ({
                "Bill No":           p.billNo,
                "Bill Date":         new Date(p.billDate).toLocaleDateString("en-IN"),
                "Patient Name":      `${p.title} ${p.name}`,
                "Gender":            p.gender,
                "Age (Yrs)":         p.ageYears,
                "Phone":             p.phone,
                "Referred By":       p.referredBy || "",
                "Tests":             (p.tests || []).map(t => t.testName).join(", "),
                "Total Amount (₹)":  p.totalAmount,
                "Discount (₹)":      p.discountAmount,
                "Bill Amount (₹)":   p.billAmount,
                "Payment Mode":      p.paymentMode,
                "Registration Date": new Date(p.registrationDate).toLocaleDateString("en-IN"),
              }))}
            />
          </CardHeader>
          <CardContent className="p-0">
            {patients.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No patients found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-white text-xs">
                      {["BILL NO", "PATIENT NAME", "GENDER/AGE", "PHONE", "TESTS", "BILL AMOUNT", "BILL DATE", "ACTIONS"].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((p, i) => (
                      <tr key={p._id} className={`border-t ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}>
                        <td className="px-3 py-2.5 font-mono text-xs">{p.billNo}</td>
                        <td className="px-3 py-2.5 font-medium">{p.title} {p.name}</td>
                        <td className="px-3 py-2.5 text-xs">{p.gender} / {p.ageYears} Yrs</td>
                        <td className="px-3 py-2.5">{p.phone}</td>
                        <td className="px-3 py-2.5 text-xs">{(p.tests || []).map(t => t.testName).join(", ")}</td>
                        <td className="px-3 py-2.5">₹{p.billAmount}</td>
                        <td className="px-3 py-2.5 text-xs">{new Date(p.billDate).toLocaleDateString("en-IN")}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => printDiagnosticBill(p)}>
                              <Printer className="h-3 w-3 mr-1" /> Print
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => navigate(`/diagnostics/edit/${p._id}`)}>
                              <Pencil className="h-3 w-3 mr-1" /> Edit
                            </Button>
                            {isAdmin && (
                              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50" onClick={() => setDeleteTarget(p)}>
                                <Trash2 className="h-3 w-3 mr-1" /> Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete patient confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Patient</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{deleteTarget?.title} {deleteTarget?.name}</span>{" "}
            <span className="font-mono text-xs text-gray-400">({deleteTarget?.billNo})</span>?
            <br />
            This will also delete their bill. This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleDeleteConfirm} disabled={deleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? "Deleting..." : "Delete Patient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
