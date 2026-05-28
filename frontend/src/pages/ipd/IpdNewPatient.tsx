import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import ipdService, {
  BED_CATEGORIES, BED_CHARGES, BLOOD_GROUPS, DIET_TYPES,
  TREATMENT_CATEGORIES, PATIENT_CATEGORIES, IPD_DEPARTMENTS,
} from "@/services/ipdService";
import opdService from "@/services/opdService";

const TITLES  = ["Mr", "Mrs", "Ms", "Dr", "Baby", "Master"];
const GENDERS = ["Male", "Female", "Other"];

const TPA_LIST = [
  "HERITAGE HEALTH INSURANCE TPA", "GENINS INSURANCE TPA", "MED-SAVE INSURANCE TPA",
  "PARAMOUNT INSURANCE TPA", "MD-INDIA INSURANCE TPA", "MEDI - ASSIS INSURANCE TPA",
  "RAKSHA INSURANCE TPA", "FAMILY HEALTH INSURANCE TPA", "HEALTH INDIA INSURANCE TPA",
  "PAREKH INSURANCE TPA", "VIDAL INSURANCE TPA", "SAFEWAY INSURANCE TPA",
  "HEALTH INSURANCE TPA", "ALANKIT INSURANCE TPA", "GOOD HEALTH INSURANCE TPA",
];

const INSURANCE_LIST = [
  "ICICI LOMBARD GENERAL INSURANCE", "FUTURE GENERALI INSURANCE", "BAJAJ ALIANZ GENERAL INSURANCE",
  "IFFCO-TOKIO GENERAL INSURANCE", "HDFC ERGO GENERAL INSURANCE", "CIGNA MANIPAL GENERAL INSURANCE",
  "UNIVERSAL SAMPO GENERAL INSURANCE", "ROYAL SUNDARAM GENERAL INSURANCE", "TATA AIG GENERAL INSURANCE",
  "RELIANCE GENERAL INSURANCE", "CHOLA MANDALAM GENERAL INSURANCE", "MAGMA HDI GENERAL INSURANCE",
  "ACKO GENERAL INSURANCE", "NAVI GENERAL INSURANCE CO.", "GO DIGIT GENERAL INSURANCE CO.",
  "NATIONAL INSURANCE CO. LTD", "NEW INDIA ASSURANCE CO. LTD", "UNITED INDIA INSURANCE CO. LTD",
  "ORIENTAL INSURANCE CO. LTD",
];

const normStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function nowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}

const EMPTY = {
  title: "Mr", name: "", gender: "", dob: "",
  ageYears: "" as string | number,
  ageMonths: "" as string | number,
  ageDays: "" as string | number,
  bloodGroup: "", dietType: "", nationality: "NATIONAL", religion: "", occupation: "",

  admissionDate: todayStr(),
  admissionTime: nowTimeStr(),

  address: "", phone: "", altPhone: "", email: "",
  postOffice: "", city: "", policeStation: "", district: "", state: "", pin: "",
  country: "India", localAddress: "",

  familyPerson: "", guardianName: "", guardianRelation: "",
  relationWithPatient: "", guardianPhone: "", guardianAddress: "",

  department: "", bedCategory: "", bedNo: "", treatmentCategory: "",

  referredBy: "", organization: "", patientHistory: "", remarks: "", remarksAccount: "",

  packageName: "", packageCharge: "" as string | number,

  patientCategory: "", insuranceCo: "", tpa: "", cardNo: "",
  policyNo: "", claimNo: "", ipdRegistrationNo: "", otherDetails: "",
};

type Doctor = { slNo: number; doctorName: string };

export default function IpdNewPatient() {
  const [form, setForm]               = useState({ ...EMPTY });
  const [doctors, setDoctors]         = useState<Doctor[]>([]);
  const [selectedDoc, setSelectedDoc] = useState("");
  const [specFilter, setSpecFilter]   = useState("");
  const [docOpen, setDocOpen]         = useState(false);
  const [allDoctors, setAllDoctors]   = useState<{ _id: string; name: string; specialization: string }[]>([]);
  const [nextId, setNextId]           = useState("");
  const [saving, setSaving]           = useState(false);
  const [occupiedBeds, setOccupiedBeds] = useState<{ bedCategory: string; bedNo: string }[]>([]);

  const occupiedNos = new Set(
    occupiedBeds.filter(b => b.bedCategory === form.bedCategory).map(b => b.bedNo)
  );
  const availableBeds = (BED_CATEGORIES.find(c => c.category === form.bedCategory)?.beds ?? [])
    .filter(b => !occupiedNos.has(b));

  useEffect(() => {
    ipdService.getNextId().then(r => setNextId(r.data.data.admissionId)).catch(() => {});
    opdService.getDoctors().then(r => {
      setAllDoctors(r.data.data.doctors || []);
    }).catch(err => console.error("Failed to load doctors", err));
    ipdService.getOccupiedBeds().then(r => setOccupiedBeds(r.data.data.beds || [])).catch(() => {});
  }, []);

  const set = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }));

  const docHits = allDoctors.filter(d =>
    (!specFilter || d.specialization === specFilter) &&
    (!selectedDoc || normStr(d.name).includes(normStr(selectedDoc)))
  );

  const handleDob = (val: string) => {
    const { years, months, days } = calcAge(val);
    setForm(f => ({ ...f, dob: val, ageYears: years, ageMonths: months, ageDays: days }));
  };

  const handleBedCategory = (cat: string) => {
    setForm(f => ({ ...f, bedCategory: cat, bedNo: "" }));
  };

  const addDoctor = () => {
    if (!selectedDoc) return;
    if (doctors.some(d => d.doctorName === selectedDoc)) return;
    setDoctors(prev => [...prev, { slNo: prev.length + 1, doctorName: selectedDoc }]);
    setSelectedDoc("");
  };

  const removeDoctor = (idx: number) => {
    setDoctors(prev => prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, slNo: i + 1 })));
  };

  const handleSave = async () => {
    if (!form.name.trim())  return toast.error("Patient name is required");
    if (!form.gender)       return toast.error("Gender is required");
    if (!form.phone.trim()) return toast.error("Phone number is required");

    setSaving(true);
    try {
      const payload = {
        ...form,
        ageYears:  Number(form.ageYears)  || 0,
        ageMonths: Number(form.ageMonths) || 0,
        ageDays:   Number(form.ageDays)   || 0,
        packageCharge: Number(form.packageCharge) || 0,
        doctors,
      };
      const res = await ipdService.createPatient(payload);
      const newPatientId = res.data?.data?._id;

      // Auto-create bed allotment if bed was assigned at admission
      if (newPatientId && form.bedCategory && form.bedNo) {
        try {
          await ipdService.createBedAllotment(newPatientId, {
            bedCategory:   form.bedCategory,
            bedNo:         form.bedNo,
            charge:        BED_CHARGES[form.bedCategory] ?? 0,
            allotmentDate: form.admissionDate,
            allotmentTime: form.admissionTime,
            effectiveTime: form.admissionTime,
          });
        } catch { /* silent — bed allotment can be added manually if needed */ }
      }

      toast.success("IPD patient admitted successfully!");
      setForm({ ...EMPTY, admissionDate: todayStr(), admissionTime: nowTimeStr() });
      setDoctors([]);
      // Refresh next ID
      ipdService.getNextId().then(r => setNextId(r.data.data.admissionId)).catch(() => {});
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to admit patient");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">IPD — New Admission</h1>
          <p className="text-gray-500 text-sm">Admit a new in-patient</p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>Admission Date: <span className="font-medium">{new Date().toLocaleDateString("en-IN")}</span></p>
          {nextId && (
            <p className="font-mono text-sm mt-0.5">
              Admission ID (Next): <span className="font-bold text-gray-800">{nextId}</span>
            </p>
          )}
        </div>
      </div>

      {/* Admission date/time row */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Admission Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Admission Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={form.admissionDate} onChange={e => set("admissionDate", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Admission Time</Label>
              <Input type="time" value={form.admissionTime} onChange={e => set("admissionTime", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Department</Label>
              <Select value={form.department} onValueChange={v => set("department", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>{IPD_DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Treatment Category</Label>
              <Select value={form.treatmentCategory} onValueChange={v => set("treatmentCategory", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>{TREATMENT_CATEGORIES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bed Category</Label>
              <Select value={form.bedCategory} onValueChange={handleBedCategory}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>{BED_CATEGORIES.map(c => <SelectItem key={c.category} value={c.category}>{c.category}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bed No</Label>
              <Select value={form.bedNo} onValueChange={v => set("bedNo", v)} disabled={!form.bedCategory}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>{availableBeds.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Details */}
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
              <Label className="text-xs">Age (Yrs / Mon / Days)</Label>
              <div className="flex gap-1">
                <Input value={form.ageYears}  onChange={e => set("ageYears",  e.target.value)} placeholder="Yrs" className="h-9 text-sm text-center" />
                <Input value={form.ageMonths} onChange={e => set("ageMonths", e.target.value)} placeholder="Mon" className="h-9 text-sm text-center" />
                <Input value={form.ageDays}   onChange={e => set("ageDays",   e.target.value)} placeholder="Day" className="h-9 text-sm text-center" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Blood Group</Label>
              <Select value={form.bloodGroup} onValueChange={v => set("bloodGroup", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>{BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Diet Type</Label>
              <Select value={form.dietType} onValueChange={v => set("dietType", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>{DIET_TYPES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nationality</Label>
              <Input value={form.nationality} onChange={e => set("nationality", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Religion</Label>
              <Input value={form.religion} onChange={e => set("religion", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Occupation</Label>
              <Input value={form.occupation} onChange={e => set("occupation", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Details */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Contact Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1 lg:col-span-3">
              <Label className="text-xs">Address</Label>
              <Input value={form.address} onChange={e => set("address", e.target.value)} className="h-9 text-sm" placeholder="Full address" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone <span className="text-red-500">*</span></Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} className="h-9 text-sm" maxLength={10} placeholder="Mobile number" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alternate Phone</Label>
              <Input value={form.altPhone} onChange={e => set("altPhone", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="h-9 text-sm" />
            </div>
            {[
              { label: "Post Office",    field: "postOffice"    },
              { label: "City",           field: "city"          },
              { label: "Police Station", field: "policeStation" },
              { label: "District",       field: "district"      },
              { label: "Pin Code",       field: "pin"           },
              { label: "State",          field: "state"         },
              { label: "Country",        field: "country"       },
              { label: "Local Address",  field: "localAddress"  },
            ].map(({ label, field }) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={(form as any)[field]} onChange={e => set(field, e.target.value)} className="h-9 text-sm" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Guardian Details */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Guardian / Attendant Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Family Person",         field: "familyPerson"        },
              { label: "Guardian Name",          field: "guardianName"        },
              { label: "Relation",               field: "guardianRelation"    },
              { label: "Relation with Patient",  field: "relationWithPatient" },
              { label: "Guardian Phone",         field: "guardianPhone"       },
              { label: "Guardian Address",       field: "guardianAddress"     },
            ].map(({ label, field }) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={(form as any)[field]} onChange={e => set(field, e.target.value)} className="h-9 text-sm" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Under Doctor */}
      <Card className="overflow-visible">
        <CardHeader className="pb-3"><CardTitle className="text-base">Under Doctor</CardTitle></CardHeader>
        <CardContent className="space-y-3 overflow-visible">
          <div className="flex gap-2 flex-wrap">
            <Select value={specFilter || "all"} onValueChange={v => { setSpecFilter(v === "all" ? "" : v); setSelectedDoc(""); }}>
              <SelectTrigger className="h-9 text-sm w-52"><SelectValue placeholder="All specializations" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All specializations</SelectItem>
                {[...new Set(allDoctors.map(d => d.specialization).filter(Boolean))].sort().map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-48">
              <div className="relative">
                <Input
                  value={selectedDoc}
                  onChange={e => { setSelectedDoc(e.target.value); setDocOpen(true); }}
                  onFocus={() => setDocOpen(true)}
                  onBlur={() => setTimeout(() => setDocOpen(false), 150)}
                  placeholder="Search doctor…"
                  className="h-9 text-sm pr-8"
                />
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {docOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
                  {docHits.length === 0
                    ? <div className="px-3 py-2 text-sm text-muted-foreground">{allDoctors.length === 0 ? "Loading doctors…" : "No doctors found"}</div>
                    : docHits.map(d => (
                        <div key={d._id}
                          onMouseDown={() => {
                            const name = d.name;
                            if (!doctors.some(ex => ex.doctorName === name)) {
                              setDoctors(prev => [...prev, { slNo: prev.length + 1, doctorName: name }]);
                            }
                            setSelectedDoc("");
                            setDocOpen(false);
                          }}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground">
                          {d.name}
                        </div>
                      ))
                  }
                </div>
              )}
            </div>
            <Button type="button" size="sm" className="h-9 bg-red-600 hover:bg-red-700 shrink-0" onClick={addDoctor}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          {doctors.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 w-12">SL#</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Doctor Name</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doc, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 text-gray-500">{doc.slNo}</td>
                    <td className="px-3 py-2 font-medium">{doc.doctorName}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => removeDoctor(i)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Other Details */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Other Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Referred By</Label>
              <Input value={form.referredBy} onChange={e => set("referredBy", e.target.value)} className="h-9 text-sm" placeholder="Doctor / hospital name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Organisation</Label>
              <Input value={form.organization} onChange={e => set("organization", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <Label className="text-xs">Patient History</Label>
              <Input value={form.patientHistory} onChange={e => set("patientHistory", e.target.value)} className="h-9 text-sm" placeholder="Existing conditions, allergies…" />
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label className="text-xs">Remarks (General)</Label>
              <Input value={form.remarks} onChange={e => set("remarks", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label className="text-xs">Remarks (Account)</Label>
              <Input value={form.remarksAccount} onChange={e => set("remarksAccount", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Package Details */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Package Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Package</Label>
              <Input value={form.packageName} onChange={e => set("packageName", e.target.value)} className="h-9 text-sm" placeholder="Package name (if any)" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Charge (₹)</Label>
              <Input type="number" value={form.packageCharge} onChange={e => set("packageCharge", e.target.value)} className="h-9 text-sm" min={0} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TPA Details */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">TPA / Insurance Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Patient Category</Label>
              <Select value={form.patientCategory} onValueChange={v => set("patientCategory", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>{PATIENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Insurance Company</Label>
              <SearchableSelect options={INSURANCE_LIST} value={form.insuranceCo} onChange={v => set("insuranceCo", v)} placeholder="Search insurance..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">TPA</Label>
              <SearchableSelect options={TPA_LIST} value={form.tpa} onChange={v => set("tpa", v)} placeholder="Search TPA..." />
            </div>
            {[
              { label: "Card No",         field: "cardNo"            },
              { label: "Policy No",       field: "policyNo"          },
              { label: "Claim No",        field: "claimNo"           },
              { label: "Registration No", field: "ipdRegistrationNo" },
              { label: "Other Details",   field: "otherDetails"      },
            ].map(({ label, field }) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={(form as any)[field]} onChange={e => set(field, e.target.value)} className="h-9 text-sm" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-6">
        <Button type="button" variant="outline"
          onClick={() => { setForm({ ...EMPTY, admissionDate: todayStr(), admissionTime: nowTimeStr() }); setDoctors([]); setSelectedDoc(""); setSpecFilter(""); }}>
          Reset
        </Button>
        <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 px-8" disabled={saving}>
          {saving ? "Saving..." : "Admit Patient"}
        </Button>
      </div>
    </div>
  );
}
