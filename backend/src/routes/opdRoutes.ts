import express from "express";
import * as opdService from "../services/opdService.js";

const router = express.Router();

// GET today's bookings with patient and doctor info
router.get("/stats/today-activity", async (req, res) => {
  try {
    const activity = await opdService.getTodayActivity();
    res.json({ success: true, data: { activity } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET dashboard stats — OPD admissions and revenue today vs yesterday
router.get("/stats/dashboard", async (req, res) => {
  try {
    const stats = await opdService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET active doctors (fetched from Users with role Doctor)
router.get("/doctors", async (req, res) => {
  try {
    const doctors = await opdService.getDoctors();
    res.json({ success: true, data: { doctors } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET next registration preview
router.get("/patients/next-id", async (req, res) => {
  try {
    const data = await opdService.getNextPatientId();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Create new OPD patient
router.post("/patients", async (req, res) => {
  try {
    const patient = await opdService.createPatient(req.body);
    res.status(201).json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Search / list patients
router.get("/patients", async (req, res) => {
  try {
    const patients = await opdService.searchPatients(req.query as any);
    res.json({ success: true, data: { patients } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get single patient by MongoDB _id
router.get("/patients/:id", async (req, res) => {
  try {
    const patient = await opdService.getPatient(req.params.id);
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Update patient
router.put("/patients/:id", async (req, res) => {
  try {
    const patient = await opdService.updatePatient(req.params.id, req.body);
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Create booking
router.post("/bookings", async (req, res) => {
  try {
    const { patientId, isNewRegistration, ...bookingData } = req.body;
    const booking = await opdService.createBooking(patientId, bookingData);
    res.status(201).json({ success: true, data: booking });
  } catch (err: any) {
    const status = err.message === "Patient not found" ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

// Get bookings for a patient
router.get("/bookings/patient/:patientId", async (req, res) => {
  try {
    const bookings = await opdService.getPatientBookings(req.params.patientId);
    res.json({ success: true, data: { bookings } });
  } catch (err: any) {
    const status = err.message === "Patient not found" ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

// Get single booking by MongoDB _id
router.get("/bookings/:id", async (req, res) => {
  try {
    const booking = await opdService.getBooking(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json({ success: true, data: booking });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Update booking
router.put("/bookings/:id", async (req, res) => {
  try {
    const booking = await opdService.updateBooking(req.params.id, req.body);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json({ success: true, data: booking });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Create prescription
router.post("/prescriptions", async (req, res) => {
  try {
    const { patientId, ...prescriptionData } = req.body;
    const prescription = await opdService.createPrescription(patientId, prescriptionData);
    res.status(201).json({ success: true, data: prescription });
  } catch (err: any) {
    const status = err.message === "Patient not found" ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

// Get prescriptions for a patient
router.get("/prescriptions/patient/:patientId", async (req, res) => {
  try {
    const prescriptions = await opdService.getPatientPrescriptions(req.params.patientId);
    res.json({ success: true, data: { prescriptions } });
  } catch (err: any) {
    const status = err.message === "Patient not found" ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

export default router;
