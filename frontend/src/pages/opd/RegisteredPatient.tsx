import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, Eye, Pencil, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import opdService from "@/services/opdService";
import DatePresetFilter, { type DatePreset, getDateRange } from "@/components/DatePresetFilter";
import EditPatientModal from "@/components/opd/EditPatientModal";
import EditBookingModal from "@/components/opd/EditBookingModal";
import { useAuth } from "@/contexts/AuthContext";
import logoUrl from "@/assets/logo.png";

interface Patient {
  _id: string; patientId: string; registrationNo: string;
  title: string; name: string; gender: string; ageYears: number;
  phone: string; registrationType: string; registrationDate: string;
}

interface Booking {
  _id: string;
  bookingId: string; department: string; doctorName: string;
  visitDate: string; serviceType: string;
  services: { serviceName: string; charge: number }[];
  totalAmount: number; registrationAmount: number; cardCharge: number; discount: number;
  billAmount: number; status: string; remarks?: string;
}

export default function RegisteredPatient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role.toLowerCase() === "admin";

  const [search,   setSearch]   = useState({ name: "", phone: "", patientId: "", registrationNo: "" });
  const [preset,   setPreset]   = useState<DatePreset | null>("today");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  // Previous bookings modal
  const [prevBookings,    setPrevBookings]    = useState<Booking[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPrev,        setShowPrev]        = useState(false);
  const [loadingPrev,     setLoadingPrev]     = useState(false);

  // Edit patient modal
  const [editPatientId, setEditPatientId] = useState<string | null>(null);
  const [showEditPatient, setShowEditPatient] = useState(false);

  // Edit booking modal
  const [editBookingId, _setEditBookingId] = useState<string | null>(null);
  const [showEditBooking, setShowEditBooking] = useState(false);

  // Delete patient
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPatients = async (params: Record<string, string>) => {
    setLoading(true);
    try {
      const res = await opdService.searchPatients(params);
      setPatients(res.data.data.patients);
      setSearched(true);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { from, to } = getDateRange("today");
    fetchPatients({ from: from.toISOString(), to: to.toISOString() });
  }, []);

  // Text search — no date filter; deactivates any preset
  const handleSearch = () => {
    const params = Object.fromEntries(
      Object.entries(search).filter(([, v]) => v.trim() !== "")
    );
    if (Object.keys(params).length === 0) return;
    setPreset(null);
    fetchPatients(params);
  };

  // Preset — date filter only; clears text search
  const handlePresetChange = (p: DatePreset) => {
    const cleared = { name: "", phone: "", patientId: "", registrationNo: "" };
    setSearch(cleared);
    setPreset(p);
    const { from, to } = getDateRange(p);
    fetchPatients({ from: from.toISOString(), to: to.toISOString() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  const handleBook = (patient: Patient) => navigate(`/opd/book/${patient._id}`);

  const handlePrevDetails = async (patient: Patient) => {
    setSelectedPatient(patient);
    setShowPrev(true);
    setLoadingPrev(true);
    try {
      const res = await opdService.getPatientBookings(patient._id);
      setPrevBookings(res.data.data.bookings);
    } catch {
      toast.error("Failed to load bookings");
    } finally {
      setLoadingPrev(false);
    }
  };

  const handleEditPatient = (patient: Patient) => {
    setEditPatientId(patient._id);
    setShowEditPatient(true);
  };

  // const handleEditBooking = (booking: Booking) => {
  //   setEditBookingId(booking._id);
  //   setShowEditBooking(true);
  // };

  const handlePatientSaved = (updated: any) => {
    setPatients(prev => prev.map(p => p._id === updated._id ? { ...p, ...updated } : p));
    if (selectedPatient?._id === updated._id) setSelectedPatient(s => ({ ...s!, ...updated }));
  };

  const handleBookingSaved = (updated: any) => {
    setPrevBookings(prev => prev.map(b => b._id === updated._id ? { ...b, ...updated } : b));
  };

  const printBill = (b: Booking) => {
    const patient = selectedPatient!;
    const win = window.open("", "_blank", "width=720,height=640");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
    <title>OPD Receipt – ${patient.patientId}</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; font-size: 12px; color: #333; }
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
      @media print { button { display: none; } body { margin: 0; } .header-container { border-bottom-color: #800000 !important; -webkit-print-color-adjust: exact; } }
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
        <td class="label">Booking ID:</td><td>${b.bookingId}</td>
      </tr>
      <tr>
        <td class="label">Age / Gender:</td><td>${patient.ageYears} Yrs / ${patient.gender}</td>
        <td class="label">Contact No:</td><td>${patient.phone}</td>
      </tr>
      <tr>
        <td class="label">Department:</td><td>${b.department}</td>
        <td class="label">Consultant:</td><td><b>${b.doctorName}</b></td>
      </tr>
      <tr>
        <td class="label">Visit Date:</td><td>${new Date(b.visitDate).toLocaleDateString("en-IN")}</td>
        <td class="label">Status:</td><td><b style="color:green;">${b.status}</b></td>
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
        ${(b.services || []).map((s, i) => `
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
        <tr><td>Total Service Amount</td><td style="text-align:right;">₹${Number(b.totalAmount).toFixed(2)}</td></tr>
        ${b.registrationAmount > 0 ? `<tr><td>Registration Fee</td><td style="text-align:right;">₹${Number(b.registrationAmount).toFixed(2)}</td></tr>` : ""}
        ${b.cardCharge > 0 ? `<tr><td>Card Charges</td><td style="text-align:right;">₹${Number(b.cardCharge).toFixed(2)}</td></tr>` : ""}
        ${b.discount > 0 ? `<tr style="color:green;"><td>Discount Allowed (${b.discount}%)</td><td style="text-align:right;">- ₹${((b.discount / 100) * b.totalAmount).toFixed(2)}</td></tr>` : ""}
        <tr class="bold-row"><td>Net Bill Amount</td><td style="text-align:right;">₹${Number(b.billAmount).toFixed(2)}</td></tr>
      </table>
    </div>
    <p style="clear:both; margin-top:20px; font-size:10px;"><b>Remarks:</b> ${b.remarks || 'N/A'}</p>
    <div class="footer">
      <p>This is a computer generated receipt. Signature not required.</p>
      <p>Thank you for choosing Arogya Maternity & Nursing Home.</p>
    </div>
    <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };<\/script>
    </body></html>`);
    win.document.close();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await opdService.deletePatient(deleteTarget._id);
      setPatients(prev => prev.filter(p => p._id !== deleteTarget._id));
      toast.success("Patient deleted successfully");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete patient");
    } finally {
      setDeleting(false);
    }
  };

  const s = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Registered Patient</h1>
        <p className="text-gray-500 text-sm">Search an existing patient to make a new booking</p>
      </div>

      {/* Search form */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Search Patient</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs mb-2 block">Date Filter</Label>
            <DatePresetFilter value={preset} onChange={handlePresetChange} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Patient Name</Label>
              <Input value={search.name} onChange={s("name")} onKeyDown={handleKeyDown} placeholder="Enter name..." className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={search.phone} onChange={s("phone")} onKeyDown={handleKeyDown} placeholder="Mobile number" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Registration No</Label>
              <Input value={search.registrationNo} onChange={s("registrationNo")} onKeyDown={handleKeyDown} placeholder="e.g. 26/150" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Patient ID</Label>
              <Input value={search.patientId} onChange={s("patientId")} onKeyDown={handleKeyDown} placeholder="e.g. OPD260400150" className="h-9 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              const cleared = { name: "", phone: "", patientId: "", registrationNo: "" };
              setSearch(cleared);
              setPreset("today");
              const { from, to } = getDateRange("today");
              fetchPatients({ from: from.toISOString(), to: to.toISOString() });
            }}>
              Clear
            </Button>
            <Button onClick={handleSearch} className="bg-red-600 hover:bg-red-700" disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">
              {patients.length > 0 ? `${patients.length} patient(s) found` : "No patients found"}
              {loading && <span className="ml-2 text-gray-400 font-normal">Loading...</span>}
            </CardTitle>
          </CardHeader>
          {patients.length > 0 && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-white text-xs">
                      {["PATIENT ID","REG NO","PATIENT NAME","GENDER/AGE","PHONE","REG TYPE","REG DATE","ACTIONS"].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((p, i) => (
                      <tr key={p._id} className={`border-t ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}>
                        <td className="px-3 py-2.5 font-mono text-xs">{p.patientId}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{p.registrationNo}</td>
                        <td className="px-3 py-2.5 font-medium">{p.title} {p.name}</td>
                        <td className="px-3 py-2.5 text-xs">{p.gender} / {p.ageYears} Yrs</td>
                        <td className="px-3 py-2.5">{p.phone}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className="text-xs">{p.registrationType}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs">{new Date(p.registrationDate).toLocaleDateString("en-IN")}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => handleBook(p)}>
                              <BookOpen className="h-3 w-3 mr-1" /> Booking
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handlePrevDetails(p)}>
                              <Eye className="h-3 w-3 mr-1" /> Prev.Dtls
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => handleEditPatient(p)}>
                              <Pencil className="h-3 w-3 mr-1" /> Edit
                            </Button>
                            {isAdmin && (
                              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50" onClick={() => setDeleteTarget(p)}>
                                <Trash2 className="h-3 w-3 mr-1" /> Delete
                              </Button>
                            )}
                          </div>
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

      {/* Previous Details dialog */}
      <Dialog open={showPrev} onOpenChange={setShowPrev}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Previous Bookings — {selectedPatient?.title} {selectedPatient?.name}
              <span className="ml-2 font-mono text-sm text-gray-400">({selectedPatient?.registrationNo})</span>
            </DialogTitle>
          </DialogHeader>
          {loadingPrev ? (
            <p className="text-center py-6 text-gray-400">Loading...</p>
          ) : prevBookings.length === 0 ? (
            <p className="text-center py-6 text-gray-400">No previous bookings found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-white text-xs">
                    {["BOOKING ID","DEPT","DOCTOR","VISIT DATE","SERVICE","AMOUNT","STATUS","PRINT"].map(h => (
                      <th key={h} className="text-left px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prevBookings.map((b, i) => (
                    <tr key={b.bookingId} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2 font-mono text-xs">{b.bookingId}</td>
                      <td className="px-3 py-2">{b.department}</td>
                      <td className="px-3 py-2">{b.doctorName}</td>
                      <td className="px-3 py-2 text-xs">{new Date(b.visitDate).toLocaleDateString("en-IN")}</td>
                      <td className="px-3 py-2">
                        {b.services && b.services.length > 0 ? (
                          <ul className="list-none space-y-0.5">
                            {b.services.map((s, i) => (
                              <li key={i} className="text-xs">{s.serviceName} <span className="text-gray-400">₹{s.charge}</span></li>
                            ))}
                          </ul>
                        ) : b.serviceType}
                      </td>
                      <td className="px-3 py-2">₹{b.billAmount}</td>
                      <td className="px-3 py-2">
                        <Badge className={b.status === "Paid" ? "bg-green-100 text-green-700 text-xs" : "bg-yellow-100 text-yellow-700 text-xs"}>
                          {b.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs text-gray-600 border-gray-300 hover:bg-gray-50" onClick={() => printBill(b)}>
                          <Printer className="h-3 w-3 mr-1" /> Print
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Patient modal */}
      <EditPatientModal
        patientId={editPatientId}
        open={showEditPatient}
        onOpenChange={setShowEditPatient}
        onSaved={handlePatientSaved}
      />

      {/* Edit Booking modal */}
      <EditBookingModal
        bookingId={editBookingId}
        open={showEditBooking}
        onOpenChange={setShowEditBooking}
        onSaved={handleBookingSaved}
      />

      {/* Delete Patient confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Patient</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{deleteTarget?.title} {deleteTarget?.name}</span>{" "}
            <span className="font-mono text-xs text-gray-400">({deleteTarget?.registrationNo})</span>?
            <br />
            This will also delete all associated bookings and prescriptions. This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleDeleteConfirm} disabled={deleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? "Deleting..." : "Delete Patient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
