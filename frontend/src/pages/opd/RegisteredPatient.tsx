import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import opdService from "@/services/opdService";
import EditPatientModal from "@/components/opd/EditPatientModal";
import EditBookingModal from "@/components/opd/EditBookingModal";

interface Patient {
  _id: string; patientId: string; registrationNo: string;
  title: string; name: string; gender: string; ageYears: number;
  phone: string; registrationType: string; registrationDate: string;
}

interface Booking {
  _id: string;
  bookingId: string; department: string; doctorName: string;
  visitDate: string; serviceType: string; billAmount: number; status: string;
}

export default function RegisteredPatient() {
  const navigate = useNavigate();

  const [search,   setSearch]   = useState({ name: "", phone: "", patientId: "", registrationNo: "" });
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
  const [editBookingId, setEditBookingId] = useState<string | null>(null);
  const [showEditBooking, setShowEditBooking] = useState(false);

  const handleSearch = async () => {
    const { name, phone, patientId, registrationNo } = search;
    if (!name && !phone && !patientId && !registrationNo) {
      return toast.error("Enter at least one search criterion");
    }
    setLoading(true);
    try {
      const res = await opdService.searchPatients({ name, phone, patientId, registrationNo });
      setPatients(res.data.data.patients);
      setSearched(true);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
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

  const handleEditBooking = (booking: Booking) => {
    setEditBookingId(booking._id);
    setShowEditBooking(true);
  };

  const handlePatientSaved = (updated: any) => {
    setPatients(prev => prev.map(p => p._id === updated._id ? { ...p, ...updated } : p));
    if (selectedPatient?._id === updated._id) setSelectedPatient(s => ({ ...s!, ...updated }));
  };

  const handleBookingSaved = (updated: any) => {
    setPrevBookings(prev => prev.map(b => b._id === updated._id ? { ...b, ...updated } : b));
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
        <CardContent>
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
          <div className="flex justify-end mt-4 gap-2">
            <Button variant="outline" onClick={() => { setSearch({ name:"", phone:"", patientId:"", registrationNo:"" }); setPatients([]); setSearched(false); }}>
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
            </CardTitle>
          </CardHeader>
          {patients.length > 0 && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-white text-xs">
                      {["REG NO","PATIENT NAME","GENDER/AGE","PHONE","REG TYPE","REG DATE","ACTIONS"].map(h => (
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
                    {["BOOKING ID","DEPT","DOCTOR","VISIT DATE","SERVICE","AMOUNT","STATUS",""].map(h => (
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
                      <td className="px-3 py-2">{b.serviceType}</td>
                      <td className="px-3 py-2">₹{b.billAmount}</td>
                      <td className="px-3 py-2">
                        <Badge className={b.status === "Paid" ? "bg-green-100 text-green-700 text-xs" : "bg-yellow-100 text-yellow-700 text-xs"}>
                          {b.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                          onClick={() => handleEditBooking(b)}>
                          <Pencil className="h-3 w-3 mr-1" /> Edit
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
    </div>
  );
}
