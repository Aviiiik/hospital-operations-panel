import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, FlaskConical, LogOut, ReceiptText, IndianRupee, BedDouble, Receipt, Pill, ChevronDown } from "lucide-react";
import ipdService, {
  BED_CATEGORIES, BLOOD_GROUPS, DIET_TYPES,
  TREATMENT_CATEGORIES, PATIENT_CATEGORIES, IPD_DEPARTMENTS, DISCHARGE_TYPES,
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
  let m = today.getMonth()   - birth.getMonth();
  let d = today.getDate()    - birth.getDate();
  if (d < 0) { m--; d += 30; }
  if (m < 0) { y--; m += 12; }
  return { years: y || "", months: m || "", days: d || "" };
}

type Doctor = { slNo: number; doctorName: string };

export default function IpdEditPatient() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [form, setForm]               = useState<any>(null);
  const [doctors, setDoctors]         = useState<Doctor[]>([]);
  const [selectedDoc, setSelectedDoc] = useState("");
  const [specFilter, setSpecFilter]   = useState("");
  const [docOpen, setDocOpen]         = useState(false);
  const [allDoctors, setAllDoctors]   = useState<{ _id: string; name: string; specialization: string; department: string }[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [occupiedBeds, setOccupiedBeds] = useState<{ _id: string; bedCategory: string; bedNo: string }[]>([]);

  const occupiedNos = new Set(
    occupiedBeds
      .filter(b => b.bedCategory === form?.bedCategory && b._id !== id)
      .map(b => b.bedNo)
  );
  const availableBeds = (BED_CATEGORIES.find(c => c.category === form?.bedCategory)?.beds ?? [])
    .filter(b => !occupiedNos.has(b));

  useEffect(() => {
    if (!id) return;
    ipdService.getPatient(id)
      .then(r => {
        const p = r.data.data;
        setForm({
          ...p,
          admissionDate: p.admissionDate ? new Date(p.admissionDate).toISOString().slice(0, 10) : "",
          dob: p.dob ? new Date(p.dob).toISOString().slice(0, 10) : "",
          dischargeDate: p.dischargeDate ? new Date(p.dischargeDate).toISOString().slice(0, 10) : "",
        });
        setDoctors(p.doctors || []);
      })
      .catch(() => toast.error("Failed to load patient"))
      .finally(() => setLoading(false));

    opdService.getDoctors().then(r => {
      setAllDoctors(r.data.data.doctors || []);
    }).catch(err => console.error("Failed to load doctors", err));

    ipdService.getOccupiedBeds().then(r => setOccupiedBeds(r.data.data.beds || [])).catch(() => {});
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  if (!form)   return <div className="flex items-center justify-center h-64 text-red-500">Patient not found</div>;

  const set = (field: string, val: any) => setForm((f: any) => ({ ...f, [field]: val }));

  const handleDob = (val: string) => {
    const { years, months, days } = calcAge(val);
    setForm((f: any) => ({ ...f, dob: val, ageYears: years, ageMonths: months, ageDays: days }));
  };

  const handleBedCategory = (cat: string) => setForm((f: any) => ({ ...f, bedCategory: cat, bedNo: "" }));

  const addDoctor = () => {
    if (!selectedDoc) return;
    if (doctors.some(d => d.doctorName === selectedDoc)) {
      toast.error("Doctor already added");
      return;
    }
    setDoctors(prev => [...prev, { slNo: prev.length + 1, doctorName: selectedDoc }]);
    setSelectedDoc("");
  };

  const removeDoctor = (idx: number) => {
    setDoctors(prev => prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, slNo: i + 1 })));
  };

  const docHits = allDoctors.filter(d =>
    (!specFilter || d.specialization === specFilter) &&
    (!selectedDoc || normStr(d.name).includes(normStr(selectedDoc)))
  );

  const handleSave = async () => {
    if (!form.name?.trim())  return toast.error("Patient name is required");
    if (!form.gender)        return toast.error("Gender is required");
    if (!form.phone?.trim()) return toast.error("Phone number is required");

    setSaving(true);
    try {
      const payload = {
        ...form,
        ageYears:      Number(form.ageYears)      || 0,
        ageMonths:     Number(form.ageMonths)     || 0,
        ageDays:       Number(form.ageDays)       || 0,
        packageCharge: Number(form.packageCharge) || 0,
        doctors,
      };
      await ipdService.updatePatient(id!, payload);
      toast.success("Patient record updated successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update patient");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/ipd/search")} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">IPD — Edit Admission</h1>
            <p className="text-gray-500 text-sm font-mono">{form.admissionId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
            onClick={() => navigate(`/ipd/services/${id}`)}>
            <ReceiptText className="h-4 w-4" /> Services
          </Button>
          <Button variant="outline" className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            onClick={() => navigate(`/ipd/bed-allotment/${id}`)}>
            <BedDouble className="h-4 w-4" /> Bed Allotment
          </Button>
          <Button variant="outline" className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() => navigate(`/ipd/billing/${id}`)}>
            <IndianRupee className="h-4 w-4" /> Billing
          </Button>
          <Button variant="outline" className="gap-2 border-teal-300 text-teal-700 hover:bg-teal-50"
            onClick={() => navigate(`/ipd/receipt/${id}`)}>
            <Receipt className="h-4 w-4" /> Receipt
          </Button>
          <Button variant="outline" className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
            onClick={() => navigate(`/ipd/investigation/${id}`)}>
            <FlaskConical className="h-4 w-4" /> Investigation
          </Button>
          <Button variant="outline" className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
            onClick={() => navigate(`/ipd/pharmacy/${id}`)}>
            <Pill className="h-4 w-4" /> Pharmacy
          </Button>
          <Button variant="outline" className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={() => navigate(`/ipd/discharge/${id}`)}>
            <LogOut className="h-4 w-4" /> Discharge
          </Button>
          <Select value={form.status || "Admitted"} onValueChange={v => set("status", v)}>
            <SelectTrigger className={`h-9 w-36 text-sm font-medium border-2 ${
              form.status === "Admitted" ? "border-green-400 text-green-700" : "border-gray-300 text-gray-600"
            }`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Admitted">Admitted</SelectItem>
              <SelectItem value="Discharged">Discharged</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Discharge section — shown only when discharged */}
      {form.status === "Discharged" && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3"><CardTitle className="text-base text-orange-800">Discharge Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Discharge Date</Label>
                <Input type="date" value={form.dischargeDate || ""} onChange={e => set("dischargeDate", e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Discharge Time</Label>
                <Input type="time" value={form.dischargeTime || ""} onChange={e => set("dischargeTime", e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Discharge Type</Label>
                <Select value={form.dischargeType || "none"} onValueChange={v => set("dischargeType", v === "none" ? "" : v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Select --</SelectItem>
                    {DISCHARGE_TYPES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Referred To</Label>
                <Input value={form.referredTo || ""} onChange={e => set("referredTo", e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admission Details */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Admission Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Admission Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={form.admissionDate || ""} onChange={e => set("admissionDate", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Admission Time</Label>
              <Input type="time" value={form.admissionTime || ""} onChange={e => set("admissionTime", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Department</Label>
              <Select value={form.department || "none"} onValueChange={v => set("department", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select --</SelectItem>
                  {IPD_DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Treatment Category</Label>
              <Select value={form.treatmentCategory || "none"} onValueChange={v => set("treatmentCategory", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select --</SelectItem>
                  {TREATMENT_CATEGORIES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bed Category</Label>
              <Input value={form.bedCategory || "—"} disabled className="h-9 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bed No</Label>
              <Input value={form.bedNo || "—"} disabled className="h-9 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
              <p className="text-xs text-amber-600 mt-0.5">To change bed, use <button type="button" className="underline font-medium hover:text-amber-700" onClick={() => navigate(`/ipd/bed-allotment/${id}`)}>Bed Allotment</button>.</p>
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
                <Select value={form.title || "Mr"} onValueChange={v => set("title", v)}>
                  <SelectTrigger className="w-24 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={form.name || ""} onChange={e => set("name", e.target.value)} placeholder="Full name" className="h-9 text-sm flex-1" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Gender <span className="text-red-500">*</span></Label>
              <Select value={form.gender || "none"} onValueChange={v => set("gender", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select --</SelectItem>
                  {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Date of Birth</Label>
              <Input type="date" value={form.dob || ""} onChange={e => handleDob(e.target.value)} className="h-9 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Age (Yrs / Mon / Days)</Label>
              <div className="flex gap-1">
                <Input value={form.ageYears  || ""} onChange={e => set("ageYears",  e.target.value)} placeholder="Yrs" className="h-9 text-sm text-center" />
                <Input value={form.ageMonths || ""} onChange={e => set("ageMonths", e.target.value)} placeholder="Mon" className="h-9 text-sm text-center" />
                <Input value={form.ageDays   || ""} onChange={e => set("ageDays",   e.target.value)} placeholder="Day" className="h-9 text-sm text-center" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Blood Group</Label>
              <Select value={form.bloodGroup || "none"} onValueChange={v => set("bloodGroup", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select --</SelectItem>
                  {BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Diet Type</Label>
              <Select value={form.dietType || "none"} onValueChange={v => set("dietType", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select --</SelectItem>
                  {DIET_TYPES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nationality</Label>
              <Input value={form.nationality || ""} onChange={e => set("nationality", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Religion</Label>
              <Input value={form.religion || ""} onChange={e => set("religion", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Occupation</Label>
              <Input value={form.occupation || ""} onChange={e => set("occupation", e.target.value)} className="h-9 text-sm" />
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
              <Input value={form.address || ""} onChange={e => set("address", e.target.value)} className="h-9 text-sm" placeholder="Full address" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone <span className="text-red-500">*</span></Label>
              <Input value={form.phone || ""} onChange={e => set("phone", e.target.value)} className="h-9 text-sm" maxLength={10} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alternate Phone</Label>
              <Input value={form.altPhone || ""} onChange={e => set("altPhone", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} className="h-9 text-sm" />
            </div>
            {[
              { label: "Post Office",   field: "postOffice"   },
              { label: "City",          field: "city"         },
              { label: "Police Station",field: "policeStation"},
              { label: "District",      field: "district"     },
              { label: "Pin Code",      field: "pin"          },
              { label: "State",         field: "state"        },
              { label: "Country",       field: "country"      },
              { label: "Local Address", field: "localAddress" },
            ].map(({ label, field }) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={form[field] || ""} onChange={e => set(field, e.target.value)} className="h-9 text-sm" />
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
              { label: "Family Person",        field: "familyPerson"        },
              { label: "Guardian Name",         field: "guardianName"        },
              { label: "Relation",              field: "guardianRelation"    },
              { label: "Relation with Patient", field: "relationWithPatient" },
              { label: "Guardian Phone",        field: "guardianPhone"       },
              { label: "Guardian Address",      field: "guardianAddress"     },
            ].map(({ label, field }) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={form[field] || ""} onChange={e => set(field, e.target.value)} className="h-9 text-sm" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Under Doctor */}
      <Card className="overflow-visible">
        <CardHeader className="pb-3"><CardTitle className="text-base">Under Doctor</CardTitle></CardHeader>
        <CardContent className="space-y-3 overflow-visible">
          {/* Filters row */}
          <div className="flex gap-2 flex-wrap">
            {/* Specialization filter */}
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
              <Input value={form.referredBy || ""} onChange={e => set("referredBy", e.target.value)} className="h-9 text-sm" placeholder="Doctor / hospital name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Organisation</Label>
              <Input value={form.organization || ""} onChange={e => set("organization", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <Label className="text-xs">Patient History</Label>
              <Input value={form.patientHistory || ""} onChange={e => set("patientHistory", e.target.value)} className="h-9 text-sm" placeholder="Existing conditions, allergies…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Remarks (General)</Label>
              <Input value={form.remarks || ""} onChange={e => set("remarks", e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Remarks (Account)</Label>
              <Input value={form.remarksAccount || ""} onChange={e => set("remarksAccount", e.target.value)} className="h-9 text-sm" />
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
              <Input value={form.packageName || ""} onChange={e => set("packageName", e.target.value)} className="h-9 text-sm" placeholder="Package name (if any)" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Charge (₹)</Label>
              <Input type="number" value={form.packageCharge || ""} onChange={e => set("packageCharge", e.target.value)} className="h-9 text-sm" min={0} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TPA / Insurance */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">TPA / Insurance Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Patient Category</Label>
              <Select value={form.patientCategory || "none"} onValueChange={v => set("patientCategory", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select --</SelectItem>
                  {PATIENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Insurance Company</Label>
              <SearchableSelect options={INSURANCE_LIST} value={form.insuranceCo || ""} onChange={v => set("insuranceCo", v)} placeholder="Search insurance..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">TPA</Label>
              <SearchableSelect options={TPA_LIST} value={form.tpa || ""} onChange={v => set("tpa", v)} placeholder="Search TPA..." />
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
                <Input value={form[field] || ""} onChange={e => set(field, e.target.value)} className="h-9 text-sm" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-6">
        <Button type="button" variant="outline" onClick={() => navigate("/ipd/search")}>
          Cancel
        </Button>
        <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 px-8" disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
