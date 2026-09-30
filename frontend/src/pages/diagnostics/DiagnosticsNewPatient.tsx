import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Printer, Plus } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import PatientFormFields, {
  EMPTY_PATIENT_FORM, validatePatientForm, toPatientPayload,
} from "@/components/diagnostics/PatientFormFields";
import BillFields, {
  EMPTY_BILL_FORM, validateBillForm, toBillPayload, type BillFormState,
} from "@/components/diagnostics/BillFields";
import diagnosticsService, { type DiagnosticPatient } from "@/services/diagnosticsService";
import { printDiagnosticBill } from "@/lib/diagnosticsPrint";

// Patient + bill are always submitted together — the patient row is never
// created until the bill fields validate too, so there is no way to save a
// patient with no bill.
export default function DiagnosticsNewPatient() {
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();
  const [patientForm, setPatientForm] = useState({ ...EMPTY_PATIENT_FORM });
  const [billForm, setBillForm]       = useState<BillFormState>({ ...EMPTY_BILL_FORM });
  const [nextBillNo, setNextBillNo]   = useState("");
  const [saving, setSaving]           = useState(false);
  const [savedPatient, setSavedPatient] = useState<DiagnosticPatient | null>(null);

  useEffect(() => {
    diagnosticsService.getNextBillNo().then(r => setNextBillNo(r.data.data.billNo)).catch(() => {});
  }, []);

  const handleSave = async () => {
    const patientError = validatePatientForm(patientForm);
    if (patientError) return toast.error(patientError);
    const billError = validateBillForm(billForm);
    if (billError) return toast.error(billError);
    if (!(await confirm({ title: "Register patient & save bill?", description: "This will register the patient and generate their bill together.", confirmText: "Yes, save" }))) return;

    setSaving(true);
    try {
      const res = await diagnosticsService.createPatient({
        ...toPatientPayload(patientForm),
        ...toBillPayload(billForm),
      });
      setSavedPatient(res.data.data);
      toast.success("Patient registered and bill saved!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save patient");
    } finally {
      setSaving(false);
    }
  };

  const startAnother = () => {
    setSavedPatient(null);
    setPatientForm({ ...EMPTY_PATIENT_FORM });
    setBillForm({ ...EMPTY_BILL_FORM });
    diagnosticsService.getNextBillNo().then(r => setNextBillNo(r.data.data.billNo)).catch(() => {});
  };

  if (savedPatient) {
    return (
      <Card className="border-green-200 bg-green-50 max-w-xl mx-auto">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
          <h3 className="text-lg font-bold text-green-800">Patient Registered & Bill Saved!</h3>
          <div className="text-sm text-green-700 space-y-1">
            <p>Patient: <span className="font-bold">{savedPatient.title} {savedPatient.name}</span></p>
            <p>Bill No: <span className="font-mono font-bold">{savedPatient.billNo}</span></p>
            <p>Tests: {(savedPatient.tests || []).map(t => t.testName).join(", ")}</p>
            <p>Bill Amount: <span className="font-bold">₹{savedPatient.billAmount}</span> ({savedPatient.paymentMode})</p>
          </div>
          <div className="flex justify-center gap-2">
            <Button onClick={() => printDiagnosticBill(savedPatient)} className="bg-blue-600 hover:bg-blue-700">
              <Printer className="h-4 w-4 mr-2" /> Print Bill
            </Button>
            <Button variant="outline" onClick={startAnother}>
              <Plus className="h-4 w-4 mr-2" /> Register Another
            </Button>
            <Button variant="outline" onClick={() => navigate("/diagnostics/search")}>
              Go to Search
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">New Diagnostics Patient</h1>
          <p className="text-gray-500 text-sm">Register a patient and save their bill in one step</p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>Registration Date: <span className="font-medium">{new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</span></p>
          {nextBillNo && (
            <p className="font-mono text-sm mt-0.5">
              Bill No (Next): <span className="font-bold text-gray-800">{nextBillNo}</span>
            </p>
          )}
        </div>
      </div>

      <PatientFormFields form={patientForm} setForm={setPatientForm} />
      <BillFields form={billForm} setForm={setBillForm} billNo={nextBillNo} />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => { setPatientForm({ ...EMPTY_PATIENT_FORM }); setBillForm({ ...EMPTY_BILL_FORM }); }}>
          Reset
        </Button>
        <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 px-8" disabled={saving}>
          {saving ? "Saving..." : "Save Patient & Bill"}
        </Button>
      </div>

      <ConfirmDialog />
    </div>
  );
}
