import User from "../models/User.js";
import OpdPatient from "../models/OpdPatient.js";
import OpdBooking from "../models/OpdBooking.js";
import OpdPrescription from "../models/OpdPrescription.js";

export const getYear = () => new Date().getFullYear().toString().slice(-2);

export const getRandomThreeDigits = () => Math.floor(100 + Math.random() * 900).toString();

export async function getDoctors() {
  return User.find({ role: "Doctor", isActive: true })
    .select("name department specialization consultancyFees")
    .sort({ name: 1 });
}

export async function getNextPatientId() {
  const year = getYear();
  const randomPart = getRandomThreeDigits();
  return {
    year,
    sequence: 1,
    registrationNo: `${year}/${randomPart}/001`,
    patientId: `OPD${year}${randomPart}001`,
  };
}

export async function createPatient(data: any) {
  const year = getYear();
  const randomPart = getRandomThreeDigits();
  const registrationNo = `${year}/${randomPart}/001`;
  const patientId = `OPD${year}${randomPart}001`;
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
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return OpdBooking.find({ createdAt: { $gte: todayStart, $lte: todayEnd } })
    .populate("patient", "name patientId phone")
    .sort({ createdAt: -1 })
    .limit(100);
}

export async function getDashboardStats() {
  const now = new Date();
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const yestStart   = new Date(todayStart); yestStart.setDate(yestStart.getDate() - 1);
  const yestEnd     = new Date(todayEnd);   yestEnd.setDate(yestEnd.getDate() - 1);

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
  const year = getYear();
  const count = await OpdPrescription.countDocuments();
  const prescriptionId = `RX${year}${String(count + 1).padStart(5, "0")}`;
  return OpdPrescription.create({ ...prescriptionData, patient: patient._id, prescriptionId });
}

export async function getPatientPrescriptions(patientId: string) {
  const patient = await OpdPatient.findById(patientId);
  if (!patient) throw new Error("Patient not found");
  return OpdPrescription.find({ patient: patient._id }).sort({ createdAt: -1 });
}
