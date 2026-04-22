import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import opdService from "@/services/opdService";

const TITLES = ["Mr", "Mrs", "Ms", "Dr", "Baby", "Master"];
const GENDERS = ["Male", "Female", "Other"];

interface Props {
  patientId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (updated: any) => void;
}

export default function EditPatientModal({ patientId, open, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && patientId) {
      setLoading(true);
      opdService.getPatient(patientId)
        .then(r => setForm(r.data.data))
        .catch(() => toast.error("Failed to load patient details"))
        .finally(() => setLoading(false));
    }
  }, [open, patientId]);

  const set = (field: string, val: any) => setForm((f: any) => ({ ...f, [field]: val }));

  const handleSave = async () => {
    if (!form?.name)  return toast.error("Patient name is required");
    if (!form?.gender) return toast.error("Gender is required");
    if (!form?.phone)  return toast.error("Phone number is required");

    setSaving(true);
    try {
      const res = await opdService.updatePatient(patientId!, {
        ...form,
        ageYears:  Number(form.ageYears)  || 0,
        ageMonths: Number(form.ageMonths) || 0,
        ageDays:   Number(form.ageDays)   || 0,
      });
      toast.success("Patient updated successfully!");
      onSaved(res.data.data);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update patient");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Patient Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-center py-8 text-gray-400">Loading...</p>
        ) : !form ? null : (
          <div className="space-y-6">
            {/* Personal */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Personal Details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Patient Name <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2">
                    <Select value={form.title || "Mr"} onValueChange={v => set("title", v)}>
                      <SelectTrigger className="w-24 h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input value={form.name || ""} onChange={e => set("name", e.target.value)} placeholder="Full name" className="h-9 text-sm flex-1" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Gender <span className="text-red-500">*</span></Label>
                  <Select value={form.gender || ""} onValueChange={v => set("gender", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                    <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Date of Birth</Label>
                  <Input type="date" value={form.dob?.split("T")[0] || ""} onChange={e => set("dob", e.target.value)} className="h-9 text-sm" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Age (Yrs / Mon / Day)</Label>
                  <div className="flex gap-1">
                    <Input value={form.ageYears  ?? ""} onChange={e => set("ageYears",  e.target.value)} placeholder="Yrs" className="h-9 text-sm text-center" />
                    <Input value={form.ageMonths ?? ""} onChange={e => set("ageMonths", e.target.value)} placeholder="Mon" className="h-9 text-sm text-center" />
                    <Input value={form.ageDays   ?? ""} onChange={e => set("ageDays",   e.target.value)} placeholder="Day" className="h-9 text-sm text-center" />
                  </div>
                </div>

                {([
                  { label: "Nationality", field: "nationality" },
                  { label: "Religion",    field: "religion"    },
                  { label: "Caste",       field: "caste"       },
                  { label: "Occupation",  field: "occupation"  },
                ] as const).map(({ label, field }) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input value={form[field] || ""} onChange={e => set(field, e.target.value)} className="h-9 text-sm" />
                  </div>
                ))}
              </div>
            </div>

            {/* Address & Contact */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Address & Contact</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1 lg:col-span-3">
                  <Label className="text-xs">Address</Label>
                  <Input value={form.address || ""} onChange={e => set("address", e.target.value)} className="h-9 text-sm" placeholder="Full address" />
                </div>

                {([
                  { label: "Post Office",    field: "postOffice"    },
                  { label: "Police Station", field: "policeStation" },
                  { label: "District",       field: "district"      },
                  { label: "State",          field: "state"         },
                  { label: "Pin",            field: "pin"           },
                  { label: "City",           field: "city"          },
                  { label: "Country",        field: "country"       },
                  { label: "Phone *",        field: "phone"         },
                  { label: "Alt. Phone",     field: "altPhone"      },
                  { label: "Email",          field: "email"         },
                ] as const).map(({ label, field }) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input value={form[field] || ""} onChange={e => set(field, e.target.value)} className="h-9 text-sm" />
                  </div>
                ))}
              </div>
            </div>

            {/* Other */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Other Details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {([
                  { label: "Referred By",  field: "referredBy"   },
                  { label: "Coll. Centre", field: "collCentre"   },
                  { label: "Organization", field: "organization" },
                ] as const).map(({ label, field }) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input value={form[field] || ""} onChange={e => set(field, e.target.value)} className="h-9 text-sm" />
                  </div>
                ))}

                <div className="space-y-1 lg:col-span-3">
                  <Label className="text-xs">Patient History</Label>
                  <Input value={form.patientHistory || ""} onChange={e => set("patientHistory", e.target.value)} className="h-9 text-sm" placeholder="Existing conditions, allergies, etc." />
                </div>
              </div>
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
