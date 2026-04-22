import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import BookingForm, { OpdPatient, PreviousBooking } from "@/components/opd/BookingForm";
import opdService from "@/services/opdService";
import { toast } from "sonner";

export default function BookingPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [patient,   setPatient]   = useState<OpdPatient | null>(null);
  const [bookings,  setBookings]  = useState<PreviousBooking[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!patientId) return;
    Promise.all([
      opdService.getPatient(patientId),
      opdService.getPatientBookings(patientId),
    ])
      .then(([pRes, bRes]) => {
        setPatient(pRes.data.data);
        setBookings(bRes.data.data.bookings);
      })
      .catch(() => toast.error("Failed to load patient data"))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div className="p-10 text-center text-gray-400">Loading patient data...</div>;
  if (!patient) return <div className="p-10 text-center text-gray-400">Patient not found.</div>;

  return (
    <div className="space-y-4">
      <Button variant="outline" asChild className="text-sm h-8">
        <Link to="/opd/registered">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Search
        </Link>
      </Button>

      <BookingForm
        patient={patient}
        existingBookings={bookings}
        onSaved={newBooking => setBookings(prev => [newBooking, ...prev])}
      />
    </div>
  );
}
