import express from "express";
import jwt from "jsonwebtoken";
import * as opdService from "../services/opdService.js";

const router = express.Router();

const requireAdmin = (req: any, res: any, next: any) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  try {
    const decoded: any = jwt.verify(auth.slice(7), process.env.JWT_SECRET || "fallback_secret");
    if (decoded.role !== "Admin") return res.status(403).json({ message: "Admin access required" });
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

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

const requireAdminOrReceptionist = (req: any, res: any, next: any) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  try {
    const decoded: any = jwt.verify(auth.slice(7), process.env.JWT_SECRET || "fallback_secret");
    const role = decoded.role?.toLowerCase();
    if (role !== "admin" && role !== "receptionist") return res.status(403).json({ message: "Access denied" });
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

// POST create doctor — admin or receptionist
router.post("/doctors", requireAdminOrReceptionist, async (req, res) => {
  try {
    const doctor = await opdService.createDoctor(req.body);
    res.status(201).json({ success: true, data: doctor });
  } catch (err: any) {
    const status = err.message.includes("already exists") ? 400 : 500;
    res.status(status).json({ message: err.message });
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

// Delete patient (and associated bookings/prescriptions)
router.delete("/patients/:id", async (req, res) => {
  try {
    const patient = await opdService.deletePatient(req.params.id);
    res.json({ success: true, data: patient });
  } catch (err: any) {
    const status = err.message === "Patient not found" ? 404 : 500;
    res.status(status).json({ message: err.message });
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
