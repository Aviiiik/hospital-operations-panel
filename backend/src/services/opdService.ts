import bcrypt from "bcryptjs";
import User from "../models/User.js";
import OpdPatient from "../models/OpdPatient.js";
import OpdBooking from "../models/OpdBooking.js";
import OpdPrescription from "../models/OpdPrescription.js";

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
  const { year } = istYearMonth();
  const yearStart = new Date(`${year}-01-01T00:00:00+05:30`);
  const yearEnd   = new Date(`${year + 1}-01-01T00:00:00+05:30`);
  yearEnd.setMilliseconds(yearEnd.getMilliseconds() - 1);
  const count = await OpdPatient.countDocuments({ registrationDate: { $gte: yearStart, $lte: yearEnd } });
  const serial = String(count + 1).padStart(5, "0");
  return { shortYear: String(year).slice(-2), serial };
}

export async function getDoctors() {
  return User.find({ role: "Doctor", isActive: true })
    .select("name username mobile department specialization shift licenseNumber consultancyFees")
    .sort({ name: 1 });
}

export async function getNextPatientId() {
  const { year, month, serial } = await getNextMonthlySerial();
  const patientId = `OPD${year}${month}${serial}`;
  return { patientId };
}

export async function createPatient(data: any) {
  const { year, month, serial: monthSerial } = await getNextMonthlySerial();
  const patientId = `OPD${year}${month}${monthSerial}`;
  const { shortYear, serial: regSerial } = await getNextYearlyRegistrationSerial();
  const registrationNo = `${shortYear}/${regSerial}/001`;
  const validity = new Date();
  validity.setFullYear(validity.getFullYear() + 1);
  return OpdPatient.create({ ...data, patientId, registrationNo, sequenceNo: 1, validity });
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

export async function getTodayActivity() {
  const { start: todayStart, end: todayEnd } = istDayBounds(0);
  return OpdBooking.find({ createdAt: { $gte: todayStart, $lte: todayEnd } })
    .populate("patient", "name patientId phone")
    .sort({ createdAt: -1 })
    .limit(100);
}

export async function getDashboardStats() {
  const { start: todayStart, end: todayEnd } = istDayBounds(0);
  const { start: yestStart,  end: yestEnd  } = istDayBounds(-1);

  const [todayAdmissions, yestAdmissions, todayRevAgg, yestRevAgg] = await Promise.all([
    OpdBooking.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
    OpdBooking.countDocuments({ createdAt: { $gte: yestStart,  $lte: yestEnd  } }),
    OpdBooking.aggregate([
      { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: "$billAmount" } } },
    ]),
    OpdBooking.aggregate([
      { $match: { createdAt: { $gte: yestStart, $lte: yestEnd } } },
      { $group: { _id: null, total: { $sum: "$billAmount" } } },
    ]),
  ]);

  return {
    admissions: { today: todayAdmissions, yesterday: yestAdmissions },
    revenue:    { today: todayRevAgg[0]?.total || 0, yesterday: yestRevAgg[0]?.total || 0 },
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
