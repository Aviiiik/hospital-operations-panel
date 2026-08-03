import bcrypt from "bcryptjs";
import User from "../models/User.js";
import OpdPatient from "../models/OpdPatient.js";
import OpdBooking from "../models/OpdBooking.js";
import OpdPrescription from "../models/OpdPrescription.js";
import OpdService from "../models/OpdService.js";

// Returns UTC Date objects bounding the start/end of an IST calendar day.
// offsetDays=0 → today IST, offsetDays=-1 → yesterday IST, etc.
function istDayBounds(offsetDays = 0): { start: Date; end: Date } {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  const istDate = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  return {
    start: new Date(`${istDate}T00:00:00+05:30`),
    end:   new Date(`${istDate}T23:59:59.999+05:30`),
  };
}

// Returns current year/month in IST (VPS runs UTC so we must convert).
function istYearMonth(): { year: number; month: number } {
  const [year, month] = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .split("-").map(Number);
  return { year, month };
}

async function getNextMonthlySerial(): Promise<{ year: string; month: string; serial: string }> {
  const { year, month } = istYearMonth();
  const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`);
  const nextMonth  = month === 12 ? 1 : month + 1;
  const nextYear   = month === 12 ? year + 1 : year;
  const monthEnd   = new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+05:30`);
  monthEnd.setMilliseconds(monthEnd.getMilliseconds() - 1);
  const count = await OpdPatient.countDocuments({ registrationDate: { $gte: monthStart, $lte: monthEnd } });
  const serial = String(count + 1).padStart(4, "0");
  return { year: String(year), month: String(month).padStart(2, "0"), serial };
}

async function getNextYearlyRegistrationSerial(): Promise<{ shortYear: string; serial: string }> {
  const shortYear = String(istYearMonth().year).slice(-2);
  // Find the highest-numbered registration for this year and add 1.
  // count+1 breaks when any patient is deleted — a gap in documents would
  // produce a serial that's already taken by a still-existing patient.
  const last = await OpdPatient.findOne(
    { registrationNo: { $regex: `^${shortYear}/` } },
    { registrationNo: 1 }
  ).sort({ registrationNo: -1 });
  const nextSerial = last ? parseInt(last.registrationNo.split("/")[1], 10) + 1 : 1;
  return { shortYear, serial: String(nextSerial).padStart(5, "0") };
}

export async function getDoctors() {
  return User.find({ role: "Doctor" })
    .select("name username mobile department specialization shift licenseNumber consultancyFees")
    .sort({ name: 1 });
}

export async function getAllDoctors() {
  return User.find({ role: "Doctor" })
    .select("name username mobile department specialization shift licenseNumber consultancyFees isActive")
    .sort({ name: 1 });
}

export async function updateDoctor(id: string, data: any) {
  const allowed = ["name", "department", "specialization", "shift", "licenseNumber", "consultancyFees", "isActive"];
  const update: any = {};
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key];
  }
  return User.findByIdAndUpdate(id, { $set: update }, { new: true })
    .select("name username mobile department specialization shift licenseNumber consultancyFees isActive");
}

export async function getNextPatientId() {
  const { year, month, serial } = await getNextMonthlySerial();
  const patientId = `OPD${year}${month}${serial}`;
  return { patientId };
}

export async function createPatient(data: any) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { year, month, serial: monthSerial } = await getNextMonthlySerial();
      const patientId = `OPD${year}${month}${monthSerial}`;
      const { shortYear, serial: regSerial } = await getNextYearlyRegistrationSerial();
      const registrationNo = `${shortYear}/${regSerial}/001`;
      const validity = new Date();
      validity.setMonth(validity.getMonth() + 3);
      return await OpdPatient.create({ ...data, patientId, registrationNo, sequenceNo: 1, validity });
    } catch (err: any) {
      // On duplicate key: another concurrent registration just won the race.
      // Re-query the counts (which now include that patient) and retry.
      if (err.code === 11000 && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error("Failed to create patient after 5 attempts due to concurrent registrations");
}

export async function getPatient(id: string) {
  return OpdPatient.findById(id);
}

export async function searchPatients(query: {
  name?: string; phone?: string; patientId?: string; registrationNo?: string;
  from?: string; to?: string;
}) {
  const filter: any = {};
  if (query.name)           filter.name           = { $regex: query.name, $options: "i" };
  if (query.phone)          filter.phone          = { $regex: query.phone };
  if (query.patientId)      filter.patientId      = query.patientId;
  if (query.registrationNo) filter.registrationNo = query.registrationNo;
  if (query.from || query.to) {
    filter.registrationDate = {};
    if (query.from) filter.registrationDate.$gte = new Date(query.from);
    if (query.to)   filter.registrationDate.$lte = new Date(query.to);
  }
  return OpdPatient.find(filter).sort({ createdAt: -1 }).limit(200);
}

// Resolves an optional from/to query pair to a concrete range, defaulting to
// today (IST) when either bound is missing.
function resolveRange(fromQ?: string, toQ?: string): { start: Date; end: Date } {
  if (fromQ && toQ) return { start: new Date(fromQ), end: new Date(toQ) };
  return istDayBounds(0);
}

export async function getTodayActivity(fromQ?: string, toQ?: string) {
  const { start, end } = resolveRange(fromQ, toQ);
  return OpdBooking.find({ createdAt: { $gte: start, $lte: end } })
    .populate("patient", "name patientId phone")
    .sort({ createdAt: -1 })
    .limit(200);
}

export async function getDashboardStats(fromQ?: string, toQ?: string) {
  const { start: rangeStart, end: rangeEnd } = resolveRange(fromQ, toQ);

  // Comparison period: the equal-length window immediately preceding the range.
  const rangeMs   = rangeEnd.getTime() - rangeStart.getTime();
  const prevEnd   = new Date(rangeStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - rangeMs);

  const [currentAdmissions, previousAdmissions, currentRevAgg, previousRevAgg] = await Promise.all([
    OpdBooking.countDocuments({ createdAt: { $gte: rangeStart, $lte: rangeEnd } }),
    OpdBooking.countDocuments({ createdAt: { $gte: prevStart,  $lte: prevEnd  } }),
    OpdBooking.aggregate([
      { $match: { createdAt: { $gte: rangeStart, $lte: rangeEnd } } },
      { $group: { _id: null, total: { $sum: "$billAmount" } } },
    ]),
    OpdBooking.aggregate([
      { $match: { createdAt: { $gte: prevStart, $lte: prevEnd } } },
      { $group: { _id: null, total: { $sum: "$billAmount" } } },
    ]),
  ]);

  return {
    admissions: { current: currentAdmissions, previous: previousAdmissions },
    revenue:    { current: currentRevAgg[0]?.total || 0, previous: previousRevAgg[0]?.total || 0 },
  };
}

export async function updatePatient(id: string, data: any) {
  const { patientId, registrationNo, sequenceNo, ...updateData } = data;
  return OpdPatient.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
}

export async function createBooking(patientId: string, bookingData: any) {
  const patient = await OpdPatient.findById(patientId);
  if (!patient) throw new Error("Patient not found");

  const bookingCount = await OpdBooking.countDocuments({ patient: patient._id });
  const nextSequence = bookingCount + 1;

  const parts = patient.registrationNo.split("/");
  const baseId = `${parts[0]}/${parts[1]}`;
  const newIdWithSequence = `${baseId}/${String(nextSequence).padStart(3, "0")}`;

  await OpdPatient.findByIdAndUpdate(patientId, {
    registrationNo: newIdWithSequence,
    sequenceNo: nextSequence,
  });

  return OpdBooking.create({
    ...bookingData,
    patient: patient._id,
    bookingNo: nextSequence,
    bookingId: newIdWithSequence,
    status: "Paid",
  });
}

export async function getBooking(id: string) {
  return OpdBooking.findById(id);
}

export async function getPatientBookings(patientId: string) {
  const patient = await OpdPatient.findById(patientId);
  if (!patient) throw new Error("Patient not found");
  return OpdBooking.find({ patient: patient._id }).sort({ createdAt: -1 });
}

export async function updateBooking(id: string, data: any) {
  const { bookingId, bookingNo, patient, ...updateData } = data;
  return OpdBooking.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
}

export async function createPrescription(patientId: string, prescriptionData: any) {
  const patient = await OpdPatient.findById(patientId);
  if (!patient) throw new Error("Patient not found");
  const { year } = istYearMonth();
  const count = await OpdPrescription.countDocuments();
  const prescriptionId = `RX${year}${String(count + 1).padStart(5, "0")}`;
  return OpdPrescription.create({ ...prescriptionData, patient: patient._id, prescriptionId });
}

export async function getPatientPrescriptions(patientId: string) {
  const patient = await OpdPatient.findById(patientId);
  if (!patient) throw new Error("Patient not found");
  return OpdPrescription.find({ patient: patient._id }).sort({ createdAt: -1 });
}

export async function createDoctor(data: any) {
  const { name, username, mobile, password, department, specialization, shift, licenseNumber, consultancyFees } = data;
  const normalizedUsername = username.toLowerCase();

  const existingUsername = await User.findOne({ username: normalizedUsername });
  if (existingUsername) throw new Error("User with this username already exists");

  const existingMobile = await User.findOne({ mobile });
  if (existingMobile) throw new Error("User with this mobile number already exists");

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  return User.create({
    name, username: normalizedUsername, password: hashedPassword,
    mobile, role: "Doctor", department, specialization, shift, licenseNumber, consultancyFees,
  });
}

export async function deletePatient(id: string) {
  const patient = await OpdPatient.findByIdAndDelete(id);
  if (!patient) throw new Error("Patient not found");
  await OpdBooking.deleteMany({ patient: patient._id });
  await OpdPrescription.deleteMany({ patient: patient._id });
  return patient;
}

// ─── OPD Services (catalogue) ─────────────────────────────────────────────────

export async function getOpdServices(activeOnly = true) {
  const filter: any = activeOnly ? { isActive: true } : {};
  return OpdService.find(filter).sort({ sortOrder: 1, serviceName: 1 }).lean();
}

export async function createOpdService(data: any) {
  const serviceName = String(data.serviceName || "").trim().toUpperCase();
  if (!serviceName) throw new Error("Service name is required");

  const existing = await OpdService.findOne({ serviceName });
  if (existing) throw new Error("A service with this name already exists");

  return OpdService.create({
    serviceName,
    charge:    Number(data.charge) || 0,
    isActive:  data.isActive !== false,
    sortOrder: Number(data.sortOrder) || 0,
  });
}

export async function updateOpdService(id: string, data: any) {
  const allowed = ["serviceName", "charge", "isActive", "sortOrder"];
  const update: any = {};
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key];
  }
  if (update.serviceName !== undefined) update.serviceName = String(update.serviceName).trim().toUpperCase();
  if (update.charge      !== undefined) update.charge      = Number(update.charge) || 0;
  if (update.sortOrder   !== undefined) update.sortOrder   = Number(update.sortOrder) || 0;
  return OpdService.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
}

export async function deleteOpdService(id: string) {
  return OpdService.findByIdAndDelete(id);
}
