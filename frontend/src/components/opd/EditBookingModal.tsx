import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import opdService, { OPD_DOCTORS, DEPARTMENTS, OPD_SERVICES } from "@/services/opdService";

interface ServiceItem { serviceName: string; charge: number; }

interface Props {
  bookingId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (updated: any) => void;
}

const STATUS_OPTIONS = ["Paid", "Unpaid", "Cancelled"];

export default function EditBookingModal({ bookingId, open, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && bookingId) {
      setLoading(true);
      setForm(null);
      opdService.getBooking(bookingId)
        .then(r => setForm(r.data.data))
        .catch(() => toast.error("Failed to load booking details"))
        .finally(() => setLoading(false));
    }
  }, [open, bookingId]);

  const services: ServiceItem[] = form?.services || [];
  const totalAmount = services.reduce((s, r) => s + (Number(r.charge) || 0), 0);
  const discountAmt = ((Number(form?.discount) || 0) / 100) * totalAmount;
  const billAmount  = Math.max(0, totalAmount + (Number(form?.cardCharge) || 0) - discountAmt);

  const setField = (field: string, val: any) => setForm((f: any) => ({ ...f, [field]: val }));

  const updateService = (idx: number, field: keyof ServiceItem, val: string | number) => {
    const updated = services.map((s, i) => i === idx ? { ...s, [field]: val } : s);
    setField("services", updated);
  };

  const handleDoctorChange = (name: string) => {
    const doc = OPD_DOCTORS.find(d => d.name === name);
    setForm((f: any) => {
      const svcs: ServiceItem[] = f.services || [];
      const updated = svcs.length > 0
        ? [{ ...svcs[0], charge: doc?.fees ?? svcs[0].charge }, ...svcs.slice(1)]
        : [{ serviceName: "CONSULTATION", charge: doc?.fees || 0 }];
      return { ...f, doctorName: name, services: updated };
    });
  };

  const filteredDoctors = OPD_DOCTORS.filter(d => d.department === form?.department);

  const handleSave = async () => {
    if (!form.doctorName) return toast.error("Please select a doctor");
    if (!form.visitDate)  return toast.error("Please select a visit date");

    setSaving(true);
    try {
      const res = await opdService.updateBooking(bookingId!, {
        ...form,
        services:   services.map(s => ({ ...s, charge: Number(s.charge) || 0 })),
        totalAmount,
        cardCharge: Number(form.cardCharge) || 0,
        discount:   Number(form.discount)   || 0,
        billAmount,
      });
      toast.success("Booking updated!");
      onSaved(res.data.data);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update booking");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit Booking
            {form?.bookingId && <span className="ml-2 font-mono text-sm text-gray-400">{form.bookingId}</span>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-center py-8 text-gray-400">Loading...</p>
        ) : !form ? null : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Department</Label>
                <Select value={form.department} onValueChange={v => setForm((f: any) => ({ ...f, department: v, doctorName: "" }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Doctor Name <span className="text-red-500">*</span></Label>
                <Select value={form.doctorName} onValueChange={handleDoctorChange}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select Doctor --" /></SelectTrigger>
                  <SelectContent>
                    {filteredDoctors.map(d => <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Visit Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.visitDate?.split("T")[0] || ""} onChange={e => setField("visitDate", e.target.value)} className="h-9 text-sm" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setField("status", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Services */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-xs font-semibold">Services</Label>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setField("services", [...services, { serviceName: "", charge: 0 }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add Row
                </Button>
              </div>
              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-white text-xs">
                      <th className="px-3 py-2 w-8 text-left">SL</th>
                      <th className="px-3 py-2 text-left">SERVICE</th>
                      <th className="px-3 py-2 w-32 text-right">CHARGE (₹)</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((s, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-1.5 text-gray-500 text-xs">{idx + 1}</td>
                        <td className="px-3 py-1.5">
                          <Select value={s.serviceName} onValueChange={val => {
                            const selected = OPD_SERVICES.find(os => os.serviceName === val);
                            const updated = services.map((sv, i) => i === idx ? {
                              serviceName: val,
                              charge: selected ? selected.charge : (val === "CONSULTATION" ? (OPD_DOCTORS.find(d => d.name === form.doctorName)?.fees || 0) : 0),
                            } : sv);
                            setField("services", updated);
                          }}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select Service" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CONSULTATION">CONSULTATION</SelectItem>
                              {OPD_SERVICES.map(os => <SelectItem key={os.serviceName} value={os.serviceName}>{os.serviceName}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-1.5">
                          <Input type="number" value={s.charge} onChange={e => updateService(idx, "charge", e.target.value)} className="h-8 text-sm text-right" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                            onClick={() => setField("services", services.filter((_, i) => i !== idx))}
                            disabled={services.length === 1}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charges summary */}
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Card Charge (₹)</Label>
                    <Input type="number" value={form.cardCharge || ""} onChange={e => setField("cardCharge", e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Discount (%)</Label>
                    <Input type="number" min="0" max="100" value={form.discount || ""} onChange={e => setField("discount", e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
                <div className="border rounded p-3 space-y-1 text-sm bg-gray-50">
                  <div className="flex justify-between text-gray-600"><span>Total Amount</span><span>₹{totalAmount}</span></div>
                  {Number(form.cardCharge) > 0 && <div className="flex justify-between"><span>Card Charge</span><span>+₹{form.cardCharge}</span></div>}
                  {Number(form.discount) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({form.discount}%)</span>
                      <span>-₹{discountAmt.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1"><span>Bill Amount</span><span>₹{billAmount.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Remarks</Label>
              <Input value={form.remarks || ""} onChange={e => setField("remarks", e.target.value)} placeholder="Optional remarks" className="text-sm" />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
