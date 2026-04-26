import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Printer, CheckCircle2, Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import opdService, { MEDICINES } from "@/services/opdService";

const FREQUENCIES = [
  "1-0-0 (OD Morning)", "0-1-0 (OD Afternoon)", "0-0-1 (OD Night)",
  "1-0-1 (BD)", "1-1-1 (TDS)", "1-1-1-1 (QID)",
  "Once Weekly", "Twice Weekly", "SOS (As Needed)",
];

const DURATIONS = [
  "3 Days", "5 Days", "7 Days", "10 Days", "14 Days",
  "21 Days", "1 Month", "2 Months", "3 Months", "Ongoing", "Till Review",
];

const INSTRUCTIONS = [
  "After Food", "Before Food", "With Water", "With Milk",
  "Empty Stomach", "At Bedtime", "As Directed",
];

interface Patient {
  _id: string; patientId: string; registrationNo: string;
  title: string; name: string; gender: string; ageYears: number; phone: string;
}

interface MedicineRow {
  medicineName: string; dosage: string;
  frequency: string; duration: string; instructions: string;
}

const EMPTY_MED: MedicineRow = { medicineName: "", dosage: "", frequency: "", duration: "", instructions: "" };

function printPrescription(prescription: any, patient: Patient) {
  const win = window.open("", "_blank", "width=760,height=900");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head>
    <title>E-Prescription – ${prescription.prescriptionId}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 24px; font-size: 12px; color: #222; }

      .blank-header { height: 160px; border-bottom: 1px dashed #bbb; margin-bottom: 16px; position: relative; }
      .blank-header-hint { position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%);
        font-size: 9px; color: #ccc; letter-spacing: 1px; text-transform: uppercase; }

      .rx-title { text-align: center; font-size: 15px; font-weight: bold;
        text-decoration: underline; letter-spacing: 1px; margin-bottom: 14px; }

      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px;
        border: 1px solid #ddd; padding: 10px 14px; border-radius: 4px; margin-bottom: 14px; }
      .info-grid p { margin: 0; line-height: 1.8; }
      .lbl { font-weight: bold; color: #555; }

      .doctor-line { margin-bottom: 14px; font-size: 13px; }
      .doctor-line span { font-weight: bold; }

      .rx-symbol { font-size: 32px; font-style: italic; font-weight: bold;
        margin-bottom: 8px; color: #333; }

      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #222; color: #fff; font-size: 10px; text-transform: uppercase;
        padding: 7px 10px; text-align: left; }
      td { border: 1px solid #ddd; padding: 7px 10px; vertical-align: top; }
      tr:nth-child(even) td { background: #fafafa; }

      .remarks { margin-bottom: 30px; }
      .footer { display: flex; justify-content: flex-end; margin-top: 20px; }
      .sig-block { text-align: center; }
      .sig-line { width: 200px; border-top: 1px solid #333; margin-bottom: 6px; }
      .sig-name { font-size: 12px; font-weight: bold; }
      .rx-id { font-size: 9px; color: #999; margin-top: 4px; }

      @media print {
        .blank-header-hint { display: none; }
        body { margin: 0; }
      }
    </style>
  </head><body>

    <div class="blank-header">
      <div class="blank-header-hint">Hospital Letterhead</div>
    </div>

    <div class="rx-title">E — PRESCRIPTION</div>

    <div class="info-grid">
      <p><span class="lbl">Patient Name:</span> ${patient.title} ${patient.name}</p>
      <p><span class="lbl">Date:</span> ${new Date(prescription.visitDate).toLocaleDateString("en-IN")}</p>
      <p><span class="lbl">Age / Gender:</span> ${patient.ageYears} Yrs / ${patient.gender}</p>
      <p><span class="lbl">Registration No:</span> ${patient.registrationNo}</p>
      <p><span class="lbl">Phone:</span> ${patient.phone}</p>
      <p><span class="lbl">Patient ID:</span> ${patient.patientId}</p>
    </div>

    <p class="doctor-line">Consulting Doctor: <span>${prescription.doctorName}</span></p>

    <div class="rx-symbol">&#8478;</div>

    <table>
      <thead>
        <tr>
          <th style="width:30px">#</th>
          <th>Medicine</th>
          <th style="width:70px">Dosage</th>
          <th style="width:100px">Frequency</th>
          <th style="width:75px">Duration</th>
          <th style="width:95px">Instructions</th>
        </tr>
      </thead>
      <tbody>
        ${prescription.medicines.map((m: any, i: number) => `
          <tr>
            <td>${i + 1}</td>
            <td><b>${m.medicineName}</b></td>
            <td>${m.dosage || "—"}</td>
            <td>${m.frequency || "—"}</td>
            <td>${m.duration || "—"}</td>
            <td>${m.instructions || "—"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    ${prescription.remarks ? `<p class="remarks"><b>Remarks:</b> ${prescription.remarks}</p>` : ""}

    <div class="footer">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">${prescription.doctorName}</div>
        <div class="rx-id">Prescription ID: ${prescription.prescriptionId}</div>
      </div>
    </div>

    <script>
      window.onload = function() { setTimeout(function() { window.print(); }, 500); };
    </script>
  </body></html>`);
  win.document.close();
}

export default function EPrescription() {
  const today = new Date().toISOString().split("T")[0];

  // Search state
  const [searchForm, setSearchForm] = useState({ name: "", phone: "", patientId: "", registrationNo: "" });
  const [patients,   setPatients]   = useState<Patient[]>([]);
  const [searching,  setSearching]  = useState(false);
  const [searched,   setSearched]   = useState(false);

  // Prescription form state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [doctorName,       setDoctorName]       = useState("");
  const [visitDate,        setVisitDate]        = useState(today);
  const [medicines,        setMedicines]        = useState<MedicineRow[]>([{ ...EMPTY_MED }]);
  const [remarks,          setRemarks]          = useState("");
  const [saving,           setSaving]           = useState(false);
  const [savedPrescription, setSavedPrescription] = useState<any>(null);
  const [doctors,          setDoctors]          = useState<{ name: string }[]>([]);

  useEffect(() => {
    opdService.getDoctors().then(r =>
      setDoctors(r.data.data.doctors.map((d: any) => ({ name: d.name })))
    );
  }, []);

  const sf = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearchForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSearch = async () => {
    const { name, phone, patientId, registrationNo } = searchForm;
    if (!name && !phone && !patientId && !registrationNo)
      return toast.error("Enter at least one search criterion");
    setSearching(true);
    try {
      const res = await opdService.searchPatients({ name, phone, patientId, registrationNo });
      setPatients(res.data.data.patients);
      setSearched(true);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setSavedPrescription(null);
    setDoctorName("");
    setMedicines([{ ...EMPTY_MED }]);
    setRemarks("");
  };

  const handleBack = () => {
    setSelectedPatient(null);
    setSavedPrescription(null);
  };

  const updateMed = (idx: number, field: keyof MedicineRow, val: string) => {
    setMedicines(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  };

  const addRow    = () => setMedicines(prev => [...prev, { ...EMPTY_MED }]);
  const removeRow = (idx: number) => setMedicines(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!selectedPatient) return;
    if (!doctorName)       return toast.error("Please select a doctor");
    if (!visitDate)        return toast.error("Please select a visit date");
    if (medicines.some(m => !m.medicineName)) return toast.error("Fill all medicine names");

    setSaving(true);
    try {
      const res = await opdService.createPrescription({
        patientId: selectedPatient._id,
        doctorName,
        visitDate,
        medicines,
        remarks,
      });
      setSavedPrescription(res.data.data);
      toast.success("Prescription saved!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save prescription");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">E-Prescription</h1>
        <p className="text-gray-500 text-sm">Search a patient and issue a digital prescription</p>
      </div>

      {/* Step 1: Search */}
      {!selectedPatient && (
        <>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Search Patient</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {([
                  { label: "Patient Name",    field: "name",           placeholder: "Enter name..." },
                  { label: "Phone",           field: "phone",          placeholder: "Mobile number" },
                  { label: "Registration No", field: "registrationNo", placeholder: "e.g. 26/150" },
                  { label: "Patient ID",      field: "patientId",      placeholder: "e.g. OPD260400150" },
                ] as const).map(({ label, field, placeholder }) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      value={searchForm[field]}
                      onChange={sf(field)}
                      onKeyDown={e => e.key === "Enter" && handleSearch()}
                      placeholder={placeholder}
                      className="h-9 text-sm"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-4 gap-2">
                <Button variant="outline" onClick={() => { setSearchForm({ name:"", phone:"", patientId:"", registrationNo:"" }); setPatients([]); setSearched(false); }}>
                  Clear
                </Button>
                <Button onClick={handleSearch} className="bg-red-600 hover:bg-red-700" disabled={searching}>
                  <Search className="h-4 w-4 mr-2" />
                  {searching ? "Searching..." : "Search"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {searched && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">
                  {patients.length > 0 ? `${patients.length} patient(s) found` : "No patients found"}
                </CardTitle>
              </CardHeader>
              {patients.length > 0 && (
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-800 text-white text-xs">
                          {["REG NO","PATIENT NAME","GENDER/AGE","PHONE","REG TYPE","ACTION"].map(h => (
                            <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {patients.map((p, i) => (
                          <tr key={p._id} className={`border-t ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}>
                            <td className="px-3 py-2.5 font-mono text-xs">{p.registrationNo}</td>
                            <td className="px-3 py-2.5 font-medium">{p.title} {p.name}</td>
                            <td className="px-3 py-2.5 text-xs">{p.gender} / {p.ageYears} Yrs</td>
                            <td className="px-3 py-2.5">{p.phone}</td>
                            <td className="px-3 py-2.5">
                              <Badge variant="outline" className="text-xs">{(p as any).registrationType}</Badge>
                            </td>
                            <td className="px-3 py-2.5">
                              <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700" onClick={() => handleSelectPatient(p)}>
                                Prescribe
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </>
      )}

      {/* Step 2: Prescription form */}
      {selectedPatient && !savedPrescription && (
        <>
          <Button variant="ghost" size="sm" className="text-gray-500" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Change Patient
          </Button>

          {/* Patient info bar */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4 pb-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Patient Name</p>
                  <p className="font-semibold">{selectedPatient.title} {selectedPatient.name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Age / Gender</p>
                  <p className="font-semibold">{selectedPatient.ageYears} Yrs / {selectedPatient.gender}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Registration No</p>
                  <p className="font-semibold font-mono">{selectedPatient.registrationNo}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Phone</p>
                  <p className="font-semibold">{selectedPatient.phone}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Prescription Details</CardTitle></CardHeader>
            <CardContent className="space-y-6">

              {/* Doctor + Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Consulting Doctor <span className="text-red-500">*</span></Label>
                  <Select value={doctorName} onValueChange={setDoctorName}>
                    <SelectTrigger><SelectValue placeholder="-- Select Doctor --" /></SelectTrigger>
                    <SelectContent>
                      {doctors.map(d => (
                        <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visit Date <span className="text-red-500">*</span></Label>
                  <Input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
                </div>
              </div>

              {/* Medicines table */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-sm font-semibold">Medicines</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addRow}>
                    <Plus className="h-4 w-4 mr-1" /> Add Medicine
                  </Button>
                </div>

                {/* datalist for autocomplete */}
                <datalist id="medicines-list">
                  {MEDICINES.map(m => <option key={m} value={m} />)}
                </datalist>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-800 text-white text-xs">
                        <th className="px-2 py-2 w-8 text-left">#</th>
                        <th className="px-3 py-2 text-left">MEDICINE NAME</th>
                        <th className="px-3 py-2 w-24 text-left">DOSAGE</th>
                        <th className="px-3 py-2 w-36 text-left">FREQUENCY</th>
                        <th className="px-3 py-2 w-28 text-left">DURATION</th>
                        <th className="px-3 py-2 w-28 text-left">INSTRUCTIONS</th>
                        <th className="px-2 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {medicines.map((med, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-2 py-1.5 text-gray-400 text-xs text-center">{idx + 1}</td>
                          <td className="px-3 py-1.5">
                            <Input
                              list="medicines-list"
                              value={med.medicineName}
                              onChange={e => updateMed(idx, "medicineName", e.target.value)}
                              placeholder="Type or select..."
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              value={med.dosage}
                              onChange={e => updateMed(idx, "dosage", e.target.value)}
                              placeholder="e.g. 1 tab"
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <Select value={med.frequency} onValueChange={v => updateMed(idx, "frequency", v)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-1.5">
                            <Select value={med.duration} onValueChange={v => updateMed(idx, "duration", v)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {DURATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-1.5">
                            <Select value={med.instructions} onValueChange={v => updateMed(idx, "instructions", v)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {INSTRUCTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Button
                              type="button" variant="ghost" size="icon"
                              className="h-8 w-8 text-red-500"
                              onClick={() => removeRow(idx)}
                              disabled={medicines.length === 1}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Remarks</Label>
                <Input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional notes" className="text-sm" />
              </div>

              <div className="flex justify-end pt-2 border-t">
                <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 px-8" disabled={saving}>
                  {saving ? "Saving..." : "Save Prescription"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 3: Confirmation */}
      {savedPrescription && selectedPatient && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
            <h3 className="text-lg font-bold text-green-800">Prescription Saved!</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>Prescription ID: <span className="font-mono font-bold">{savedPrescription.prescriptionId}</span></p>
              <p>Patient: {selectedPatient.title} {selectedPatient.name}</p>
              <p>Doctor: {savedPrescription.doctorName}</p>
              <p>Medicines: {savedPrescription.medicines.length} item(s)</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => printPrescription(savedPrescription, selectedPatient)} className="bg-blue-600 hover:bg-blue-700">
                <Printer className="h-4 w-4 mr-2" /> Print Prescription
              </Button>
              <Button variant="outline" onClick={() => { setSelectedPatient(null); setSavedPrescription(null); setSearched(false); setPatients([]); }}>
                New Prescription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
