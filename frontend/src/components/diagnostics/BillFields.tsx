import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { todayIST } from "@/services/ipdService";
import diagnosticsService, { PAYMENT_MODES, type DiagnosticTestItem, type DiagnosticTestRow } from "@/services/diagnosticsService";

type TestFormRow = { testName: string; department: string; charge: number | string };

export interface BillFormState {
  billDate: string;
  tests: TestFormRow[];
  discount: string;
  paymentMode: string;
  billRemarks: string;
}

export const EMPTY_BILL_FORM: BillFormState = {
  billDate: todayIST(),
  tests: [{ testName: "", department: "", charge: "" }],
  discount: "",
  paymentMode: "Cash",
  billRemarks: "",
};

export function billFormFromPatient(p: { billDate: string; tests: DiagnosticTestRow[]; discount: number; paymentMode: string; billRemarks?: string }): BillFormState {
  return {
    billDate: p.billDate ? new Date(p.billDate).toISOString().slice(0, 10) : todayIST(),
    tests: p.tests?.length
      ? p.tests.map(t => ({ testName: t.testName, department: t.department || "", charge: t.charge }))
      : [{ testName: "", department: "", charge: "" }],
    discount: p.discount ? String(p.discount) : "",
    paymentMode: p.paymentMode || "Cash",
    billRemarks: p.billRemarks || "",
  };
}

export function validateBillForm(form: BillFormState): string | null {
  if (!form.billDate) return "Please select a bill date";
  if (form.tests.some(t => !t.testName)) return "Please select a test on every row";
  return null;
}

export function toBillPayload(form: BillFormState) {
  return {
    billDate: form.billDate,
    paymentMode: form.paymentMode,
    billRemarks: form.billRemarks,
    tests: form.tests.map(t => ({ testName: t.testName, department: t.department, charge: Number(t.charge) || 0 })),
    discount: Number(form.discount) || 0,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

interface Props {
  form: BillFormState;
  setForm: React.Dispatch<React.SetStateAction<BillFormState>>;
  billNo?: string; // known (edit) or next-preview (create)
}

// Embedded bill section — tests, discount, payment mode, remarks. Used inside
// both the New Patient form and the Edit Patient form (a patient's bill is
// edited on the same page as their details, never separately); no save button
// of its own, the parent page's single submit saves patient + bill together.
export default function BillFields({ form, setForm, billNo }: Props) {
  const [catalogue, setCatalogue] = useState<DiagnosticTestItem[]>([]);

  useEffect(() => {
    diagnosticsService.getTests().then(r => setCatalogue(r.data.data.tests)).catch(() => {});
  }, []);

  const updateRow = (i: number, patch: Partial<TestFormRow>) =>
    setForm(f => ({ ...f, tests: f.tests.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) }));

  // Catalogue grouped by department (sheet order within each), for the picker.
  const groups = catalogue.reduce<Record<string, DiagnosticTestItem[]>>((acc, c) => {
    const d = c.department || "OTHER";
    (acc[d] ||= []).push(c);
    return acc;
  }, {});

  const totalAmount    = r2(form.tests.reduce((s, t) => s + (Number(t.charge) || 0), 0));
  const discountPct    = Math.min(100, Math.max(0, Number(form.discount) || 0));
  const discountAmount = r2(totalAmount * discountPct / 100);
  const billAmount     = r2(Math.max(0, totalAmount - discountAmount));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          Bill
          {billNo && <span className="text-sm font-normal text-gray-500">Bill No: <span className="font-mono font-bold text-gray-800">{billNo}</span></span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Bill Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={form.billDate} onChange={e => setForm(f => ({ ...f, billDate: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <Select value={form.paymentMode} onValueChange={v => setForm(f => ({ ...f, paymentMode: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <Label className="text-sm font-semibold">Tests</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, tests: [...f.tests, { testName: "", department: "", charge: "" }] }))}>
              <Plus className="h-4 w-4 mr-1" /> Add Row
            </Button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-white text-xs">
                  <th className="px-3 py-2 w-8 text-left">SL</th>
                  <th className="px-3 py-2 text-left">TEST</th>
                  <th className="px-3 py-2 w-32 text-left">DEPARTMENT</th>
                  <th className="px-3 py-2 w-32 text-right">RATE (₹)</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {form.tests.map((t, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-1.5 text-gray-500 text-xs">{idx + 1}</td>
                    <td className="px-3 py-1.5">
                      <Select
                        value={t.testName}
                        onValueChange={val => {
                          const found = catalogue.find(c => c.testName === val);
                          updateRow(idx, { testName: val, department: found?.department || "", charge: found ? found.charge : 0 });
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select Test" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(groups).map(([dept, items]) => (
                            <SelectGroup key={dept}>
                              <SelectLabel className="text-[10px] tracking-wider text-gray-400">{dept}</SelectLabel>
                              {items.map(c => (
                                <SelectItem key={c._id} value={c.testName}>{c.testName}</SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                          {/* Keep an edited bill's test selectable even if it was since removed from the catalogue */}
                          {t.testName && !catalogue.some(c => c.testName === t.testName) && (
                            <SelectItem value={t.testName}>{t.testName}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">{t.department || "—"}</td>
                    <td className="px-3 py-1.5">
                      <Input type="number" value={t.charge} onChange={e => updateRow(idx, { charge: e.target.value })} className="h-8 text-sm text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                        onClick={() => setForm(f => ({ ...f, tests: f.tests.filter((_, i) => i !== idx) }))} disabled={form.tests.length === 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {catalogue.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">No tests in the catalogue yet — add some under Diagnostics → Test Catalogue.</p>
          )}
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Discount (%)</Label>
              <Input type="number" min="0" max="100" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="border rounded p-3 space-y-1 text-sm bg-gray-50">
              <div className="flex justify-between text-gray-600"><span>Total Amount</span><span>₹{totalAmount}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount ({discountPct}%)</span><span>-₹{discountAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold border-t pt-1"><span>Bill Amount</span><span>₹{billAmount}</span></div>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Remarks</Label>
          <Input value={form.billRemarks} onChange={e => setForm(f => ({ ...f, billRemarks: e.target.value }))} placeholder="Optional remarks" className="text-sm" />
        </div>
      </CardContent>
    </Card>
  );
}
