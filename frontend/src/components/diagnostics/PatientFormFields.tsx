import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TITLES  = ["Mr", "Mrs", "Ms", "Dr", "Baby", "Master"];
const GENDERS = ["Male", "Female", "Other"];

export const EMPTY_PATIENT_FORM = {
  title: "Mr", name: "", gender: "", dob: "",
  ageYears: "" as string | number,
  ageMonths: "" as string | number,
  ageDays: "" as string | number,
  nationality: "NATIONAL", religion: "", caste: "", occupation: "",
  address: "", postOffice: "", policeStation: "", district: "", state: "",
  pin: "", phone: "", altPhone: "", email: "", city: "", country: "India",
  referredBy: "", collCentre: "", organization: "", patientHistory: "",
};

export type PatientForm = typeof EMPTY_PATIENT_FORM;

export function calcAge(dob: string) {
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

export function validatePatientForm(form: PatientForm): string | null {
  if (!form.name?.trim()) return "Patient name is required";
  if (!form.gender)       return "Gender is required";
  if (!form.phone?.trim()) return "Phone number is required";
  return null;
}

export function toPatientPayload(form: PatientForm) {
  return {
    ...form,
    dob:       form.dob || undefined,
    ageYears:  Number(form.ageYears)  || 0,
    ageMonths: Number(form.ageMonths) || 0,
    ageDays:   Number(form.ageDays)   || 0,
  };
}

interface Props {
  form: PatientForm;
  setForm: React.Dispatch<React.SetStateAction<PatientForm>>;
}

// Personal / Address / Other detail cards shared by the Diagnostics New Patient
// and Edit Patient pages, so both screens always stay field-for-field in sync.
export default function PatientFormFields({ form, setForm }: Props) {
  const set = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }));

  const handleDob = (val: string) => {
    const { years, months, days } = calcAge(val);
    setForm(f => ({ ...f, dob: val, ageYears: years, ageMonths: months, ageDays: days }));
  };

  const text = (label: string, field: keyof PatientForm, extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <div key={field} className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={(form[field] as any) ?? ""} onChange={e => set(field, e.target.value)} className="h-9 text-sm" {...extra} />
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Personal Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Patient Name <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Select value={form.title || "Mr"} onValueChange={v => set("title", v)}>
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
                <Input value={form.ageYears}  onChange={e => set("ageYears",  e.target.value)} placeholder="Yrs" className="h-9 text-sm text-center" />
                <Input value={form.ageMonths} onChange={e => set("ageMonths", e.target.value)} placeholder="Mon" className="h-9 text-sm text-center" />
                <Input value={form.ageDays}   onChange={e => set("ageDays",   e.target.value)} placeholder="Day" className="h-9 text-sm text-center" />
              </div>
            </div>

            {text("Nationality", "nationality", { placeholder: "NATIONAL" })}
            {text("Religion", "religion")}
            {text("Caste", "caste")}
            {text("Occupation", "occupation")}
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
            {text("Post Office", "postOffice")}
            {text("Police Station", "policeStation")}
            {text("District", "district")}
            {text("State", "state")}
            {text("Pin", "pin")}
            {text("City", "city")}
            {text("Country", "country")}
            <div className="space-y-1">
              <Label className="text-xs">Phone <span className="text-red-500">*</span></Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} className="h-9 text-sm" placeholder="Mobile number" maxLength={10} />
            </div>
            {text("Alternative Phone", "altPhone")}
            {text("Email", "email", { type: "email" })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Other Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {text("Referred By", "referredBy", { placeholder: "Doctor name" })}
            {text("Coll. Centre", "collCentre")}
            {text("Organization", "organization")}
            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <Label className="text-xs">Patient History</Label>
              <Input value={form.patientHistory} onChange={e => set("patientHistory", e.target.value)} className="h-9 text-sm" placeholder="Existing conditions, allergies, etc." />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
