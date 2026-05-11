import IpdPatient from "../models/IpdPatient.js";
import IpdInvestigation from "../models/IpdInvestigation.js";
import IpdBillingEntry from "../models/IpdBillingEntry.js";
import ServiceCatalogue from "../models/ServiceCatalogue.js";
import InvestigationVendor from "../models/InvestigationVendor.js";

function istNow(): Date {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

// ─── Billing day calculation (12 PM IST → 11:59 AM IST next day) ─────────────
// Day 1 = admission to next 12 PM IST, every subsequent 24-hour noon-to-noon = 1 more day
export function computeBillingDays(admissionDate: Date, currentDate = new Date()): number {
  const IST = 5.5 * 3600000;
  const admIST   = admissionDate.getTime() + IST;
  const nowIST   = currentDate.getTime() + IST;
  const NOON_MS  = 12 * 3600000;

  // Time-of-day in IST for admission
  const admTod = admIST % 86400000;
  // ms from admission until first 12 PM IST mark
  const msToFirstNoon = admTod < NOON_MS
    ? NOON_MS - admTod
    : 86400000 - admTod + NOON_MS;

  const msSinceAdm       = nowIST - admIST;
  if (msSinceAdm <= 0) return 1;

  const msSinceFirstNoon = msSinceAdm - msToFirstNoon;
  if (msSinceFirstNoon < 0) return 1;

  return 2 + Math.floor(msSinceFirstNoon / 86400000);
}

// ─── ID Generation ────────────────────────────────────────────────────────────

async function generateAdmissionId(): Promise<string> {
  const now = istNow();
  const year = now.getFullYear();
  const prefix = `IPD${year}`;
  const last = await IpdPatient.findOne({ admissionId: { $regex: `^${prefix}` } })
    .sort({ admissionId: -1 })
    .lean();
  let serial = 1;
  if (last) {
    const lastSerial = parseInt((last as any).admissionId.slice(prefix.length), 10);
    if (!isNaN(lastSerial)) serial = lastSerial + 1;
  }
  return `${prefix}${String(serial).padStart(5, "0")}`;
}

export async function getNextAdmissionPreview(): Promise<{ admissionId: string }> {
  const admissionId = await generateAdmissionId();
  return { admissionId };
}

// ─── Patient CRUD ─────────────────────────────────────────────────────────────

export async function createIpdPatient(data: any) {
  const admissionId = await generateAdmissionId();
  const now = istNow();
  const timeStr = data.admissionTime ||
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const patient = new IpdPatient({
    ...data,
    admissionId,
    admissionDate: data.admissionDate ? new Date(data.admissionDate) : now,
    admissionTime: timeStr,
  });
  await patient.save();
  await createDefaultBillingEntries(String(patient._id), istNow());
  return patient;
}

export async function searchIpdPatients(query: {
  name?: string; phone?: string; admissionId?: string;
  from?: string; to?: string; status?: string;
  bedNo?: string; bedCategory?: string;
}) {
  const filter: any = {};
  if (query.name)        filter.name        = { $regex: query.name,        $options: "i" };
  if (query.phone)       filter.phone       = { $regex: query.phone };
  if (query.admissionId) filter.admissionId = { $regex: query.admissionId, $options: "i" };
  if (query.status)      filter.status      = query.status;
  if (query.bedNo)       filter.bedNo       = query.bedNo;
  if (query.bedCategory) filter.bedCategory = query.bedCategory;
  if (query.from || query.to) {
    filter.admissionDate = {};
    if (query.from) filter.admissionDate.$gte = new Date(query.from);
    if (query.to)   filter.admissionDate.$lte = new Date(query.to);
  }
  return IpdPatient.find(filter).sort({ createdAt: -1 }).limit(200).lean();
}

export async function getOccupiedBeds(): Promise<{ _id: string; bedCategory: string; bedNo: string; patientName: string; admissionId: string }[]> {
  const admitted = await IpdPatient.find({ status: "Admitted", bedNo: { $exists: true, $ne: "" } })
    .select("_id bedCategory bedNo name title admissionId")
    .lean();
  return admitted.map((p: any) => ({
    _id:         String(p._id),
    bedCategory: p.bedCategory || "",
    bedNo:       p.bedNo || "",
    patientName: `${p.title || ""} ${p.name}`.trim(),
    admissionId: p.admissionId,
  }));
}

export async function getIpdPatient(id: string) {
  return IpdPatient.findById(id).lean();
}

export async function updateIpdPatient(id: string, data: any) {
  const { admissionId, ...safeData } = data;
  return IpdPatient.findByIdAndUpdate(
    id,
    { $set: safeData },
    { new: true, runValidators: true }
  ).lean();
}

// ─── Investigation ────────────────────────────────────────────────────────────

async function generateReqNo(): Promise<string> {
  const now = istNow();
  const year = now.getFullYear();
  const prefix = `INV${year}`;
  const last = await IpdInvestigation.findOne({ reqNo: { $regex: `^${prefix}` } })
    .sort({ reqNo: -1 }).lean();
  let serial = 1;
  if (last) {
    const n = parseInt((last as any).reqNo.slice(prefix.length), 10);
    if (!isNaN(n)) serial = n + 1;
  }
  return `${prefix}${String(serial).padStart(4, "0")}`;
}

export async function createInvestigation(patientId: string, data: any) {
  const patient = await IpdPatient.findById(patientId).lean() as any;
  if (!patient) throw new Error("Patient not found");

  const reqNo   = await generateReqNo();
  const now     = istNow();
  const reqTime = data.reqTime ||
    `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  const items = (data.items || []).map((item: any, i: number) => ({
    ...item,
    slNo: i + 1,
    netAmount: item.netAmount ?? item.amount ?? 0,
  }));

  const totalAmount = items.reduce((s: number, it: any) => s + Number(it.netAmount || 0), 0);

  const inv = new IpdInvestigation({
    ...data,
    reqNo,
    ipdPatientId:   patientId,
    admissionId:    patient.admissionId,
    reqDate:        data.reqDate ? new Date(data.reqDate) : now,
    reqTime,
    items,
    totalAmount,
    patientName:    data.patientName    || `${patient.title || ""} ${patient.name}`.trim(),
    sex:            data.sex            || patient.gender,
    ageYears:       data.ageYears       ?? patient.ageYears,
    phone:          data.phone          || patient.phone,
    bedDetails:     data.bedDetails     || (patient.bedCategory ? `${patient.bedCategory} (${patient.bedNo})` : ""),
    patientHistory: data.patientHistory || patient.patientHistory,
  });
  await inv.save();
  return inv;
}

export async function getPatientInvestigations(patientId: string) {
  return IpdInvestigation.find({ ipdPatientId: patientId }).sort({ createdAt: -1 }).lean();
}

export async function getInvestigation(id: string) {
  return IpdInvestigation.findById(id).lean();
}

export async function updateInvestigation(id: string, data: any) {
  const { reqNo, ipdPatientId, admissionId, ...safeData } = data;
  if (safeData.items) {
    safeData.items = safeData.items.map((it: any, i: number) => ({
      ...it, slNo: i + 1,
      netAmount: it.netAmount ?? it.amount ?? 0,
    }));
    safeData.totalAmount = safeData.items.reduce((s: number, it: any) => s + Number(it.netAmount || 0), 0);
  }
  return IpdInvestigation.findByIdAndUpdate(id, { $set: safeData }, { new: true }).lean();
}

export async function deleteInvestigation(id: string) {
  return IpdInvestigation.findByIdAndDelete(id).lean();
}

// ─── Billing ──────────────────────────────────────────────────────────────────

async function createDefaultBillingEntries(patientId: string, now: Date) {
  await IpdBillingEntry.insertMany([
    {
      patientId,
      serviceGroup:     "RGST CHARGES",
      serviceGroupCode: "24",
      serviceName:      "REGISTRATION CHARGES",
      unit:             "PER CASE",
      quantity:         1,
      unitCharge:       200,
      discount:         0,
      totalCharge:      200,
      date:             now,
      isAutoAdded:      true,
    },
    {
      patientId,
      serviceGroup:     "CONSULTATION",
      serviceGroupCode: "10",
      serviceName:      "INITIAL MANAGEMENT CHARGES",
      unit:             "PER CASE",
      quantity:         1,
      unitCharge:       2000,
      discount:         0,
      totalCharge:      2000,
      date:             now,
      isAutoAdded:      true,
    },
  ]);
}

export async function getBillingEntries(patientId: string) {
  return IpdBillingEntry.find({ patientId }).sort({ date: 1, createdAt: 1 }).lean();
}

export async function createBillingEntry(patientId: string, data: any) {
  const qty         = Number(data.quantity)   || 1;
  const unitCharge  = Number(data.unitCharge) || 0;
  const discount    = Number(data.discount)   || 0;
  const totalCharge = qty * unitCharge - discount;

  const entry = new IpdBillingEntry({
    ...data,
    patientId,
    quantity:    qty,
    unitCharge,
    discount,
    totalCharge,
    date: data.date ? new Date(data.date) : istNow(),
  });
  await entry.save();
  return entry;
}

export async function updateBillingEntry(id: string, data: any) {
  const existing = await IpdBillingEntry.findById(id).lean() as any;
  if (!existing) return null;

  const updateData: any = { ...data };
  const qty        = data.quantity   !== undefined ? Number(data.quantity)   : existing.quantity;
  const unitCharge = data.unitCharge !== undefined ? Number(data.unitCharge) : existing.unitCharge;
  const discount   = data.discount   !== undefined ? Number(data.discount)   : existing.discount;

  updateData.quantity    = qty;
  updateData.unitCharge  = unitCharge;
  updateData.discount    = discount;
  updateData.totalCharge = qty * unitCharge - discount;

  return IpdBillingEntry.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();
}

export async function deleteBillingEntry(id: string) {
  return IpdBillingEntry.findByIdAndDelete(id).lean();
}

export async function getBillingSummary(patientId: string) {
  const entries = await IpdBillingEntry.find({ patientId }).lean() as any[];
  const gross    = entries.reduce((s, e) => s + e.unitCharge * e.quantity, 0);
  const discount = entries.reduce((s, e) => s + (e.discount || 0), 0);
  const net      = entries.reduce((s, e) => s + e.totalCharge, 0);
  return { gross, discount, net, count: entries.length };
}

// ─── Service Catalogue ────────────────────────────────────────────────────────

export async function getServiceCatalogue(activeOnly = true) {
  const filter: any = activeOnly ? { isActive: true } : {};
  return ServiceCatalogue.find(filter).sort({ serviceGroup: 1, sortOrder: 1, serviceName: 1 }).lean();
}

export async function createServiceCatalogueItem(data: any) {
  const item = new ServiceCatalogue({
    serviceGroup:     data.serviceGroup,
    serviceGroupCode: data.serviceGroupCode,
    serviceName:      data.serviceName,
    unit:             data.unit || "",
    defaultCharge:    Number(data.defaultCharge) || 0,
    requiresDoctor:   Boolean(data.requiresDoctor),
    isReferral:       Boolean(data.isReferral),
    isActive:         data.isActive !== false,
    sortOrder:        Number(data.sortOrder) || 0,
  });
  await item.save();
  return item;
}

export async function updateServiceCatalogueItem(id: string, data: any) {
  const allowed = [
    "serviceName", "unit", "defaultCharge", "requiresDoctor",
    "isReferral", "isActive", "sortOrder", "serviceGroup", "serviceGroupCode",
  ];
  const updateData: any = {};
  allowed.forEach(k => { if (data[k] !== undefined) updateData[k] = data[k]; });
  if (updateData.defaultCharge !== undefined) updateData.defaultCharge = Number(updateData.defaultCharge) || 0;
  return ServiceCatalogue.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();
}

export async function deleteServiceCatalogueItem(id: string) {
  return ServiceCatalogue.findByIdAndDelete(id).lean();
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function getIpdDashboardStats() {
  const IST = 5.5 * 3600 * 1000;
  const nowIST = new Date(Date.now() + IST);
  const todayIST = new Date(nowIST);
  todayIST.setHours(0, 0, 0, 0);
  const todayStartUTC = new Date(todayIST.getTime() - IST);

  const [currentlyAdmitted, admittedToday, dischargedToday, bedsOccupied, recentRaw] =
    await Promise.all([
      IpdPatient.countDocuments({ status: "Admitted" }),
      IpdPatient.countDocuments({ admissionDate: { $gte: todayStartUTC } }),
      IpdPatient.countDocuments({ status: "Discharged", dischargeDate: { $gte: todayStartUTC } }),
      IpdPatient.countDocuments({ status: "Admitted", bedNo: { $exists: true, $ne: "" } }),
      IpdPatient.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .select("admissionId name title bedNo bedCategory department admissionDate status")
        .lean(),
    ]);

  const recentAdmissions = (recentRaw as any[]).map(p => ({
    _id:           String(p._id),
    admissionId:   p.admissionId,
    name:          `${p.title || ""} ${p.name}`.trim(),
    bedNo:         p.bedNo || "",
    bedCategory:   p.bedCategory || "",
    department:    p.department || "",
    admissionDate: p.admissionDate,
    status:        p.status,
  }));

  return { currentlyAdmitted, admittedToday, dischargedToday, bedsOccupied, recentAdmissions };
}

// ─── Investigation Vendors ────────────────────────────────────────────────────

export async function getVendors(activeOnly = true) {
  const filter: any = activeOnly ? { isActive: true } : {};
  return InvestigationVendor.find(filter).sort({ code: 1 }).lean();
}

export async function createVendor(data: any) {
  const vendor = new InvestigationVendor({
    code:     data.code,
    name:     data.name,
    isActive: data.isActive !== false,
  });
  await vendor.save();
  return vendor;
}

export async function updateVendor(id: string, data: any) {
  const allowed = ["code", "name", "isActive"];
  const update: any = {};
  allowed.forEach(k => { if (data[k] !== undefined) update[k] = data[k]; });
  return InvestigationVendor.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
}

export async function deleteVendor(id: string) {
  return InvestigationVendor.findByIdAndDelete(id).lean();
}
