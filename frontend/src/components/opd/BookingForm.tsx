import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Printer, CheckCircle2 } from "lucide-react";
import logoUrl from "@/assets/logo.png";
import { toast } from "sonner";
import opdService, { DEPARTMENTS, OPD_SERVICES } from "@/services/opdService";

interface ServiceItem { serviceName: string; charge: number; }

export interface OpdPatient {
  _id: string;
  patientId: string;
  registrationNo: string;
  title: string;
  name: string;
  gender: string;
  ageYears: number;
  phone: string;
  altPhone?: string;
  address?: string;
  pin?: string;
  referredBy?: string;
  registrationType: string;
  validity?: string;
  registrationAmount: number;
}

export interface PreviousBooking {
  bookingId: string;
  department: string;
  doctorName: string;
  visitDate: string;
  serviceType: string;
  billAmount: number;
  status: string;
}

interface Doctor { _id: string; name: string; department: string; designation: string; fees: number; }

interface Props {
  patient: OpdPatient;
  existingBookings: PreviousBooking[];
  onSaved?: (booking: any) => void;
  isNewRegistration?: boolean;
}

function printReceipt(booking: any, patient: OpdPatient) {
  const win = window.open("", "_blank", "width=720,height=640");
  if (!win) return;
  
  win.document.write(`<!DOCTYPE html><html><head>
    <title>OPD Receipt – ${patient.patientId}</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; font-size: 12px; color: #333; }
      
      /* Header Styling based on official letterhead */
      .header-container { display: flex; align-items: center; border-bottom: 2px solid #800000; padding-bottom: 10px; margin-bottom: 20px; }
      .logo-box { width: 80px; height: 80px; margin-right: 15px; }
      .header-text { flex-grow: 1; text-align: center; }
      .hospital-name { color: #800000; font-size: 22px; font-weight: bold; margin: 0; letter-spacing: 1px; }
      .hospital-sub { font-size: 11px; font-weight: 600; margin: 2px 0; color: #444; }
      .hospital-info { font-size: 10px; margin: 1px 0; line-height: 1.4; color: #555; }
      
      .receipt-title { text-align: center; font-size: 16px; font-weight: bold; text-decoration: underline; margin: 15px 0; color: #000; }
      
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
      th { background: #f9f9f9; font-weight: bold; text-transform: uppercase; font-size: 10px; }
      
      .details-grid { margin-bottom: 20px; }
      .details-grid td { border: none; padding: 4px 0; }
      .label { font-weight: bold; width: 120px; color: #555; }
      
      .amt-section { float: right; width: 50%; margin-top: 15px; }
      .amt-table td { border: 1px solid #eee; }
      .bold-row { background: #f0f0f0; font-weight: bold; font-size: 13px; }
      
      .footer { clear: both; text-align: center; margin-top: 50px; border-top: 1px dashed #ccc; padding-top: 10px; font-style: italic; color: #777; }
      
      @media print {
        button { display: none; }
        body { margin: 0; }
        .header-container { border-bottom-color: #800000 !important; -webkit-print-color-adjust: exact; }
      }
    </style></head><body>
    
    <div class="header-container">
      <div class="logo-box">
        <img src="${window.location.origin}${logoUrl}" style="width:80px;height:80px;object-fit:contain;" />
      </div>
      <div class="header-text">
        <h1 class="hospital-name">AROGYA MATERNITY & NURSING HOME</h1>
        <p class="hospital-sub">(A Unit of R.P. Medical Foundation Pvt. Ltd.)</p>
        <p class="hospital-info">(Licence Under W.B. Clinical Establishment Act) | Regd. No:- 34235649</p>
        <p class="hospital-info">71, TOLLYGUNGE CIRCULAR ROAD, KOLKATA-700053</p>
        <p class="hospital-info">(NEW ALIPORE, SITAL SADAN COMPOUND)</p>
        <p class="hospital-info">Phone: (033) 2400-0681 / 0684 | Fax No: (033) 2400-1180</p>
      </div>
    </div>

    <div class="receipt-title">OPD MONEY RECEIPT</div>

    <table class="details-grid">
      <tr>
        <td class="label">Patient Name:</td><td><b>${patient.title} ${patient.name}</b></td>
        <td class="label">Registration No:</td><td><b>${patient.registrationNo}</b></td>
      </tr>
      <tr>
        <td class="label">Patient ID:</td><td>${patient.patientId}</td>
        <td class="label">Booking ID:</td><td>${booking.bookingId}</td>
      </tr>
      <tr>
        <td class="label">Age / Gender:</td><td>${patient.ageYears} Yrs / ${patient.gender}</td>
        <td class="label">Contact No:</td><td>${patient.phone}</td>
      </tr>
      <tr>
        <td class="label">Department:</td><td>${booking.department}</td>
        <td class="label">Consultant:</td><td><b>${booking.doctorName}</b></td>
      </tr>
      <tr>
        <td class="label">Visit Date:</td><td>${new Date(booking.visitDate).toLocaleDateString("en-IN")}</td>
        <td class="label">Status:</td><td><b style="color:green;">${booking.status}</b></td>
      </tr>
    </table>

    <table>
      <thead>
        <tr>
          <th style="width:40px;">SL</th>
          <th>Description of Services</th>
          <th style="text-align:right; width:120px;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${booking.services.map((s: any, i: number) => `
          <tr>
            <td>${i + 1}</td>
            <td>${s.serviceName}</td>
            <td style="text-align:right;">${Number(s.charge).toFixed(2)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="amt-section">
      <table class="amt-table">
        <tr><td>Total Service Amount</td><td style="text-align:right;">₹${Number(booking.totalAmount).toFixed(2)}</td></tr>
        ${booking.registrationAmount > 0 ? `<tr><td>Registration Fee</td><td style="text-align:right;">₹${Number(booking.registrationAmount).toFixed(2)}</td></tr>` : ""}
        ${booking.cardCharge > 0 ? `<tr><td>Card Charges</td><td style="text-align:right;">₹${Number(booking.cardCharge).toFixed(2)}</td></tr>` : ""}
        ${booking.discount > 0 ? `<tr style="color:green;"><td>Discount Allowed (${booking.discount}%)</td><td style="text-align:right;">- ₹${((booking.discount / 100) * booking.totalAmount).toFixed(2)}</td></tr>` : ""}
        <tr class="bold-row"><td>Net Bill Amount</td><td style="text-align:right;">₹${Number(booking.billAmount).toFixed(2)}</td></tr>
      </table>
    </div>

    <p style="clear:both; margin-top:20px; font-size:10px;"><b>Remarks:</b> ${booking.remarks || 'N/A'}</p>

    <div class="footer">
      <p>This is a computer generated receipt. Signature not required.</p>
      <p>Thank you for choosing Arogya Maternity & Nursing Home.</p>
    </div>

    <script>
      window.onload = function() {
        setTimeout(function() {
          window.print();
          // window.close(); // Optional: close tab after printing
        }, 500);
      };
    </script>
    </body></html>`);
  win.document.close();
}

export default function BookingForm({ patient, existingBookings, onSaved, isNewRegistration = false }: Props) {
  const today = new Date().toISOString().split("T")[0];

  const lastDoctor = !isNewRegistration && existingBookings.length > 0 
    ? existingBookings[0].doctorName 
    : "";

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  useEffect(() => {
    opdService.getDoctors().then(r =>
      setDoctors(r.data.data.doctors.map((d: any) => ({
        _id: d._id, name: d.name, department: d.department,
        designation: d.specialization || "", fees: Number(d.consultancyFees) || 0,
      })))
    );
  }, []);

  const [department,      setDepartment]      = useState("OPD");
  const [doctorName,      setDoctorName]      = useState("");
  const [referredBy,      setReferredBy]      = useState(lastDoctor || patient.referredBy || "");
  const [visitDate,       setVisitDate]       = useState(today);
  const [visitTime,       _setVisitTime]      = useState("");
  const [services,        setServices]        = useState<ServiceItem[]>([{ serviceName: "CONSULTATION", charge: "" as any }]);
  const [cardCharge,      setCardCharge]      = useState("" as any);
  const [discount,        setDiscount]        = useState("" as any);
  const [remarks,         setRemarks]         = useState("");
  const [saving,          setSaving]          = useState(false);
  const [savedBooking,    setSavedBooking]    = useState<any>(null);

  const filteredDoctors = doctors.filter(d => d.department === department);
  const totalAmount     = services.reduce((s, r) => s + (Number(r.charge) || 0), 0);
  
  const regFee = isNewRegistration ? (patient.registrationAmount || 0) : 0;
  const billAmount = Math.max(0, totalAmount + (Number(cardCharge) || 0) + regFee - ((Number(discount)/100)*totalAmount|| 0));

  const handleDoctorChange = (name: string) => {
    setDoctorName(name);
    const doc = doctors.find(d => d.name === name);
    if (doc) setServices([{ serviceName: "CONSULTATION", charge: doc.fees }]);
  };

  const updateService = (i: number, field: keyof ServiceItem, val: string | number) => {
    const updated = [...services];
    updated[i] = { ...updated[i], [field]: val };
    setServices(updated);
  };

  const handleSave = async () => {
    if (!doctorName)                       return toast.error("Please select a doctor");
    if (!visitDate)                        return toast.error("Please select a visit date");
    if (services.some(s => !s.serviceName)) return toast.error("Please fill all service names");

    setSaving(true);
    try {
      const res = await opdService.createBooking({
        patientId: patient._id,
        isNewRegistration,
        referredBy,
        department, doctorName, visitDate, visitTime,
        serviceType: services[0]?.serviceName || "CONSULTATION",
        services: services.map(s => ({ ...s, charge: Number(s.charge) || 0 })),
        totalAmount,
        registrationAmount: regFee,
        cardCharge: Number(cardCharge) || 0,
        discount: Number(discount) || 0,
        billAmount,
        status: "Paid",
        remarks,
      });

      const newBooking = res.data.data;
      
      // Update local patient object so registrationNo is correct in printReceipt
      patient.registrationNo = newBooking.bookingId; 

      setSavedBooking(newBooking);
      toast.success("Booking saved!");
      onSaved?.(newBooking);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save booking");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Patient Name</p>
              <p className="font-semibold">{patient.title} {patient.name}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Age / Gender</p>
              <p className="font-semibold">{patient.ageYears} Yrs / {patient.gender}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Registration No</p>
              <p className="font-semibold font-mono">{patient.registrationNo}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Patient ID</p>
              <p className="font-semibold font-mono text-xs">{patient.patientId}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {existingBookings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Previous Bookings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    {["DEPARTMENT","DOCTOR NAME","VISIT DATE","SERVICE TYPE","AMOUNT","STATUS"].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {existingBookings.map((b, i) => (
                    <tr key={b.bookingId} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2">{b.department}</td>
                      <td className="px-3 py-2">{b.doctorName}</td>
                      <td className="px-3 py-2">{new Date(b.visitDate).toLocaleDateString("en-IN")}</td>
                      <td className="px-3 py-2">{b.serviceType}</td>
                      <td className="px-3 py-2">₹{b.billAmount}</td>
                      <td className="px-3 py-2">
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          {b.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!savedBooking ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Booking Details
              {isNewRegistration && <Badge className="bg-blue-600">New Registration Fee: ₹{patient.registrationAmount}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department <span className="text-red-500">*</span></Label>
                <Select value={department} onValueChange={v => { setDepartment(v); setDoctorName(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Doctor Name <span className="text-red-500">*</span></Label>
                <Select value={doctorName} onValueChange={handleDoctorChange}>
                  <SelectTrigger><SelectValue placeholder="-- Select Doctor --" /></SelectTrigger>
                  <SelectContent>
                    {filteredDoctors.map(d => (
                      <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isNewRegistration && (
                <div className="space-y-2">
                  <Label>Referred By (Previous Doctor)</Label>
                  <Select value={referredBy} onValueChange={setReferredBy}>
                    <SelectTrigger><SelectValue placeholder="-- Select Doctor --" /></SelectTrigger>
                    <SelectContent>
                      {doctors.map(d => (
                        <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Visit Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm font-semibold">Services</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setServices([...services, { serviceName: "", charge: "" as any }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add Row
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
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
        <Select 
          value={s.serviceName} 
          onValueChange={(val) => {
            // 1. Find the selected service object from your data list
            const selected = OPD_SERVICES.find(os => os.serviceName === val);
            
            // 2. Create a copy of the services array
            const updated = [...services];
            
            // 3. Update BOTH the name and the charge for this specific row
            updated[idx] = { 
              serviceName: val, 
              charge: selected ? selected.charge : (val === "CONSULTATION" ? (doctors.find(d => d.name === doctorName)?.fees || 0) : 0)
            };
            
            // 4. Save the updated array back to state
            setServices(updated);
          }}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CONSULTATION">CONSULTATION</SelectItem>
            {OPD_SERVICES.map(os => (
              <SelectItem key={os.serviceName} value={os.serviceName}>
                {os.serviceName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-1.5">
        <Input 
          type="number" 
          value={s.charge} 
          onChange={e => updateService(idx, "charge", e.target.value)} 
          className="h-8 text-sm text-right" 
        />
      </td>
      <td className="px-2 py-1.5">
        <Button 
          type="button" 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-red-500" 
          onClick={() => setServices(services.filter((_, i) => i !== idx))} 
          disabled={services.length === 1}
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

            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Card Charge (₹)</Label>
                    <Input type="number" value={cardCharge} onChange={e => setCardCharge(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Discount (%)</Label>
                    <Input type="number" min="0" max="100" value={discount} onChange={e => setDiscount(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>

                <div className="border rounded p-3 space-y-1 text-sm bg-gray-50">
                  <div className="flex justify-between text-gray-600"><span>Total Amount</span><span>₹{totalAmount}</span></div>
                  {isNewRegistration && <div className="flex justify-between text-blue-600"><span>Registration Fee</span><span>+₹{patient.registrationAmount}</span></div>}
                  {Number(cardCharge) > 0 && <div className="flex justify-between"><span>Card Charge</span><span>+₹{cardCharge}</span></div>}
                  {Number(discount) > 0 && <div className="flex justify-between text-green-600"><span>Discount ({discount}%)</span><span>-₹{((Number(discount) / 100) * totalAmount).toFixed(2)}</span></div>}
                  <div className="flex justify-between font-bold border-t pt-1"><span>Bill Amount</span><span>₹{billAmount}</span></div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Remarks</Label>
              <Input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional remarks" className="text-sm" />
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 px-8" disabled={saving}>{saving ? "Saving..." : "Save Booking"}</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
            <h3 className="text-lg font-bold text-green-800">Booking Confirmed!</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>Booking ID: <span className="font-mono font-bold">{savedBooking.bookingId}</span></p>
              <p>Doctor: {savedBooking.doctorName} &bull; Dept: {savedBooking.department}</p>
              <p>Visit Date: {new Date(savedBooking.visitDate).toLocaleDateString("en-IN")}</p>
              <p>Bill Amount: <span className="font-bold">₹{savedBooking.billAmount}</span></p>
              <p>Status: <span className="text-green-700 font-bold">{savedBooking.status}</span></p>
            </div>
            <Button onClick={() => printReceipt(savedBooking, patient)} className="bg-blue-600 hover:bg-blue-700"><Printer className="h-4 w-4 mr-2" /> Print Receipt</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}