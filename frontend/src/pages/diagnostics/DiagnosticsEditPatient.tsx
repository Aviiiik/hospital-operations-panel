import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import PatientFormFields, {
  EMPTY_PATIENT_FORM, type PatientForm, validatePatientForm, toPatientPayload,
} from "@/components/diagnostics/PatientFormFields";
import BillFields, {
  EMPTY_BILL_FORM, billFormFromPatient, validateBillForm, toBillPayload, type BillFormState,
} from "@/components/diagnostics/BillFields";
import diagnosticsService, { type DiagnosticPatient } from "@/services/diagnosticsService";
import { printDiagnosticBill } from "@/lib/diagnosticsPrint";

// Full-page editor for both the patient's details AND their bill (one doc,
// one form, one save) — Diagnostics edits always open as a page, not a modal.
export default function DiagnosticsEditPatient() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();
  const [patientForm, setPatientForm] = useState<PatientForm>({ ...EMPTY_PATIENT_FORM });
  const [billForm, setBillForm]       = useState<BillFormState>({ ...EMPTY_BILL_FORM });
  const [loaded, setLoaded]           = useState<DiagnosticPatient | null>(null);
  const [loading, setLoading]         = useState(true);
  const [notFound, setNotFound]       = useState(false);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (!id) return;
    diagnosticsService.getPatient(id)
      .then(r => {
        const p: DiagnosticPatient = r.data.data;
        const merged: any = { ...EMPTY_PATIENT_FORM };
        for (const k of Object.keys(EMPTY_PATIENT_FORM)) if ((p as any)[k] !== undefined && (p as any)[k] !== null) merged[k] = (p as any)[k];
        merged.dob = p.dob ? new Date(p.dob).toISOString().slice(0, 10) : "";
        setPatientForm(merged);
        setBillForm(billFormFromPatient(p));
        setLoaded(p);
      })
      .catch(() => { setNotFound(true); toast.error("Failed to load patient details"); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    const patientError = validatePatientForm(patientForm);
    if (patientError) return toast.error(patientError);
    const billError = validateBillForm(billForm);
    if (billError) return toast.error(billError);
    if (!(await confirm({ title: "Save changes?", description: "This will update this patient's details and their bill." }))) return;

    setSaving(true);
    try {
      await diagnosticsService.updatePatient(id!, {
        ...toPatientPayload(patientForm),
        ...toBillPayload(billForm),
      });
      toast.success("Patient and bill updated successfully!");
      navigate("/diagnostics/search");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update patient");
    } finally {
      setSaving(false);
    }
  };

  if (loading)  return <div className="p-10 text-center text-gray-400">Loading patient data...</div>;
  if (notFound || !loaded) return <div className="p-10 text-center text-gray-400">Patient not found.</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Patient & Bill</h1>
          <p className="text-gray-500 text-sm">{patientForm.title} {patientForm.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={() => printDiagnosticBill(loaded)}>
            <Printer className="h-4 w-4 mr-1" /> Print Bill
          </Button>
          <Button variant="outline" asChild className="text-sm h-8">
            <Link to="/diagnostics/search"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Search</Link>
          </Button>
        </div>
      </div>

      <PatientFormFields form={patientForm} setForm={setPatientForm} />
      <BillFields form={billForm} setForm={setBillForm} billNo={loaded.billNo} />

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/diagnostics/search")}>Cancel</Button>
        <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 px-8" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <ConfirmDialog />
    </div>
  );
}
