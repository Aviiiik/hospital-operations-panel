import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import BookingForm, { OpdPatient } from "@/components/opd/BookingForm";
import opdService, { REGISTRATION_TYPES } from "@/services/opdService";

const TITLES = ["Mr", "Mrs", "Ms", "Dr", "Baby", "Master"];
const GENDERS = ["Male", "Female", "Other"];

function calcAge(dob: string) {
  if (!dob) return { years: "", months: "", days: "" };
  const today = new Date();
  const birth = new Date(dob);
  let y = today.getFullYear() - birth.getFullYear();
  let m = today.getMonth() - birth.getMonth();
  let d = today.getDate() - birth.getDate();
  if (d < 0) { m--; d += 30; }
  if (m < 0) { y--; m += 12; }
  return { years: y || "", months: m || "", days: d || "" };
}

const EMPTY_FORM = {
  title: "Mr", name: "", gender: "", dob: "",
  ageYears: "" as string | number, 
  ageMonths: "" as string | number, 
  ageDays: "" as string | number,
  nationality: "NATIONAL", religion: "", caste: "", occupation: "",
  address: "", postOffice: "", policeStation: "", district: "", state: "",
  pin: "", phone: "", altPhone: "", email: "", city: "", country: "India",
  referredBy: "", collCentre: "", organization: "", patientHistory: "",
  registrationType: "NATIONAL", registrationAmount: 100,
  
};

export default function NewPatient() {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [nextId, setNextId] = useState<{ year: string; sequence: number; registrationNo: string; patientId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedPatient, setSavedPatient] = useState<OpdPatient | null>(null);
  const [showRegType, setShowRegType] = useState(false);

  useEffect(() => {
    opdService.getNextId().then(r => setNextId(r.data.data)).catch(() => {});
  }, []);

  const set = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }));

  const handleDob = (val: string) => {
    const { years, months, days } = calcAge(val);
    setForm(f => ({ ...f, dob: val, ageYears: years, ageMonths: months, ageDays: days }));
  };

  const handleRegType = (type: string) => {
  const found = REGISTRATION_TYPES.find(r => r.type === type);
  const amt = found?.amount ?? 100;
  setForm(f => ({
    ...f,
    registrationType: type,
    registrationAmount: amt,
  }));
  setShowRegType(false);
};
  

  const handleSave = async () => {
    if (!form.name) return toast.error("Patient name is required");
    if (!form.gender) return toast.error("Gender is required");
    if (!form.phone) return toast.error("Phone number is required");

    setSaving(true);
    try {
      // Clean data for API (convert empty strings back to 0 or null if needed)
      const submissionData = {
        ...form,
        ageYears: Number(form.ageYears) || 0,
        ageMonths: Number(form.ageMonths) || 0,
        ageDays: Number(form.ageDays) || 0,
       
      };

      const res = await opdService.createPatient(submissionData);
      const patient = res.data.data;
      setSavedPatient(patient);
      toast.success("Patient registered successfully!");
      setStep(2);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to register patient");
    } finally {
      setSaving(false);
    }
  };

  if (step === 2 && savedPatient) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="text-gray-400">New Patient</span>
          <ArrowRight className="h-3 w-3" />
          <span className="font-semibold text-gray-800">Booking</span>
        </div>
        <BookingForm 
          patient={savedPatient} 
          existingBookings={[]} 
          isNewRegistration={true} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">New Patient Registration</h1>
          <p className="text-gray-500 text-sm">Register a new patient and proceed to booking</p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>Registration Date: <span className="font-medium">{new Date().toLocaleDateString("en-IN")}</span></p>
          {nextId && (
            <p className="font-mono text-sm mt-0.5">
              Reg No (Next): <span className="font-bold text-gray-800">{nextId.registrationNo}</span>
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Personal Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Patient Name <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Select value={form.title} onValueChange={v => set("title", v)}>
                  <SelectTrigger className="w-24 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Full name" className="h-9 text-sm flex-1" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Gender <span className="text-red-500">*</span></Label>
              <Select value={form.gender} onValueChange={v => set("gender", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Date of Birth</Label>
              <Input type="date" value={form.dob} onChange={e => handleDob(e.target.value)} className="h-9 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Age</Label>
              <div className="flex gap-1">
                <Input value={form.ageYears}  onChange={e => set("ageYears",  e.target.value)} placeholder="Yrs"  className="h-9 text-sm text-center" />
                <Input value={form.ageMonths} onChange={e => set("ageMonths", e.target.value)} placeholder="Mon"  className="h-9 text-sm text-center" />
                <Input value={form.ageDays}   onChange={e => set("ageDays",   e.target.value)} placeholder="Day"  className="h-9 text-sm text-center" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nationality</Label>
              <Input value={form.nationality} onChange={e => set("nationality", e.target.value)} className="h-9 text-sm" placeholder="NATIONAL" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Religion</Label>
              <Input value={form.religion} onChange={e => set("religion", e.target.value)} className="h-9 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Caste</Label>
              <Input value={form.caste} onChange={e => set("caste", e.target.value)} className="h-9 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Occupation</Label>
              <Input value={form.occupation} onChange={e => set("occupation", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Address Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <Label className="text-xs">Address</Label>
              <Input value={form.address} onChange={e => set("address", e.target.value)} className="h-9 text-sm" placeholder="Full address" />
            </div>

            {[
              { label: "Post Office",    field: "postOffice"    },
              { label: "Police Station", field: "policeStation" },
              { label: "District",       field: "district"      },
              { label: "State",          field: "state"         },
              { label: "Pin",            field: "pin"           },
              { label: "City",           field: "city"          },
              { label: "Country",        field: "country"       },
            ].map(({ label, field }) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={(form as any)[field]} onChange={e => set(field, e.target.value)} className="h-9 text-sm" />
              </div>
            ))}

            <div className="space-y-1">
              <Label className="text-xs">Phone <span className="text-red-500">*</span></Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} className="h-9 text-sm" placeholder="Mobile number" maxLength={10} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alternative Phone</Label>
              <Input value={form.altPhone} onChange={e => set("altPhone", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Registration Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Initial Referred By</Label>
              <Input value={form.referredBy} onChange={e => set("referredBy", e.target.value)} className="h-9 text-sm" placeholder="Doctor name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Coll. Centre</Label>
              <Input value={form.collCentre} onChange={e => set("collCentre", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Organization</Label>
              <Input value={form.organization} onChange={e => set("organization", e.target.value)} className="h-9 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Registration Type</Label>
              <div className="flex gap-2 items-center h-9">
                <span className="text-sm font-medium">{form.registrationType}</span>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowRegType(true)}>
                  Change
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Registration Amount (₹)</Label>
              <Input value={form.registrationAmount} readOnly className="h-9 text-sm bg-gray-50" />
            </div>

            

           
            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <Label className="text-xs">Patient History</Label>
              <Input value={form.patientHistory} onChange={e => set("patientHistory", e.target.value)} className="h-9 text-sm" placeholder="Existing conditions, allergies, etc." />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => setForm({ ...EMPTY_FORM })}>Reset</Button>
        <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 px-8" disabled={saving}>
          {saving ? "Saving..." : "Save & Proceed to Booking"}
          {!saving && <ArrowRight className="h-4 w-4 ml-2" />}
        </Button>
      </div>

      <Dialog open={showRegType} onOpenChange={setShowRegType}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registration Type</DialogTitle></DialogHeader>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-2 text-left">TYPE</th>
                <th className="px-4 py-2 text-right">REGT AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {REGISTRATION_TYPES.map(rt => (
                <tr key={rt.type} className="border-t cursor-pointer hover:bg-red-50" onClick={() => handleRegType(rt.type)}>
                  <td className="px-4 py-3 font-medium">{rt.type}</td>
                  <td className="px-4 py-3 text-right">₹{rt.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </div>
  );
}