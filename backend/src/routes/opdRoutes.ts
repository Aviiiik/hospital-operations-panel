import express from "express";
import OpdPatient from "../models/OpdPatient.js";
import OpdBooking from "../models/OpdBooking.js";
import OpdPrescription from "../models/OpdPrescription.js";

const router = express.Router();

const getYear = () => new Date().getFullYear().toString().slice(-2);

/**
 * Helper to generate a random 3-digit string
 */
const getRandomThreeDigits = () => Math.floor(100 + Math.random() * 900).toString();

// GET next registration preview
router.get("/patients/next-id", async (req, res) => {
  try {
    const year = getYear();
    const randomPart = getRandomThreeDigits();
    // New format: YY/RAND/001 for preview
    res.json({
      success: true,
      data: {
        year,
        sequence: 1,
        registrationNo: `${year}/${randomPart}/001`,
        patientId: `OPD${year}${randomPart}001`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Create new OPD patient
router.post("/patients", async (req, res) => {
  try {
    const year = getYear();
    const randomPart = getRandomThreeDigits();
    
    // Initial registration starts at 001
    const registrationNo = `${year}/${randomPart}/001`;
    const patientId = `OPD${year}${randomPart}001`;

    const validity = new Date();
    validity.setFullYear(validity.getFullYear() + 1);

    const patient = await OpdPatient.create({
      ...req.body,
      patientId,
      registrationNo,
      sequenceNo: 1,
      validity,
    });

    res.status(201).json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Search / list patients
router.get("/patients", async (req, res) => {
  try {
    const { name, phone, patientId, registrationNo } = req.query;
    const query: any = {};
    if (name)           query.name           = { $regex: name, $options: "i" };
    if (phone)          query.phone          = { $regex: phone };
    if (patientId)      query.patientId      = patientId;
    if (registrationNo) query.registrationNo = registrationNo;

    const patients = await OpdPatient.find(query).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: { patients } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get single patient by MongoDB _id
router.get("/patients/:id", async (req, res) => {
  try {
    const patient = await OpdPatient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Update patient by MongoDB _id (protected fields: patientId, registrationNo, sequenceNo)
router.put("/patients/:id", async (req, res) => {
  try {
    const { patientId, registrationNo, sequenceNo, ...updateData } = req.body;
    const patient = await OpdPatient.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Create booking
// Create booking - Updates the Patient's registration number to the latest sequence
router.post("/bookings", async (req, res) => {
  try {
    const { patientId, isNewRegistration, ...bookingData } = req.body;

    const patient = await OpdPatient.findById(patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    // 1. Calculate next sequence based on previous bookings
    const bookingCount = await OpdBooking.countDocuments({ patient: patient._id });
    const nextSequence = bookingCount + 1;
    
    // 2. Format the new Registration/Booking ID (YY/RAND/SEQ)
    const parts = patient.registrationNo.split('/');
    const baseId = `${parts[0]}/${parts[1]}`;
    const newIdWithSequence = `${baseId}/${String(nextSequence).padStart(3, "0")}`;

    // 3. UPDATE THE PATIENT RECORD: Store the latest sequence and reg no
    await OpdPatient.findByIdAndUpdate(patientId, {
      registrationNo: newIdWithSequence,
      sequenceNo: nextSequence
    });

    // 4. Create the booking record
    const booking = await OpdBooking.create({
      ...bookingData,
      patient:   patient._id,
      bookingNo: nextSequence,
      bookingId: newIdWithSequence,
      status: "Paid" 
    });

    res.status(201).json({ success: true, data: booking });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
// Get bookings for a patient
router.get("/bookings/patient/:patientId", async (req, res) => {
  try {
    const patient = await OpdPatient.findById(req.params.patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const bookings = await OpdBooking.find({ patient: patient._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { bookings } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Create prescription
router.post("/prescriptions", async (req, res) => {
  try {
    const { patientId, ...prescriptionData } = req.body;

    const patient = await OpdPatient.findById(patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const year = getYear();
    const count = await OpdPrescription.countDocuments();
    const prescriptionId = `RX${year}${String(count + 1).padStart(5, "0")}`;

    const prescription = await OpdPrescription.create({
      ...prescriptionData,
      patient: patient._id,
      prescriptionId,
    });

    res.status(201).json({ success: true, data: prescription });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get prescriptions for a patient
router.get("/prescriptions/patient/:patientId", async (req, res) => {
  try {
    const patient = await OpdPatient.findById(req.params.patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const prescriptions = await OpdPrescription.find({ patient: patient._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { prescriptions } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get single booking by MongoDB _id
router.get("/bookings/:id", async (req, res) => {
  try {
    const booking = await OpdBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json({ success: true, data: booking });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Update booking by MongoDB _id (protected fields: bookingId, bookingNo, patient)
router.put("/bookings/:id", async (req, res) => {
  try {
    const { bookingId, bookingNo, patient, ...updateData } = req.body;
    const booking = await OpdBooking.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json({ success: true, data: booking });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;