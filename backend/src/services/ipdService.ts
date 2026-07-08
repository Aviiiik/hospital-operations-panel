import IpdPatient from "../models/IpdPatient.js";
import IpdInvestigation from "../models/IpdInvestigation.js";
import IpdBillingEntry from "../models/IpdBillingEntry.js";
import IpdBedAllotment from "../models/IpdBedAllotment.js";
import IpdReceipt from "../models/IpdReceipt.js";
import ServiceCatalogue from "../models/ServiceCatalogue.js";
import InvestigationVendor from "../models/InvestigationVendor.js";
import InvestigationItem from "../models/InvestigationItem.js";
import IpdPharmacyBill from "../models/IpdPharmacyBill.js";
import PharmacyMedicine from "../models/PharmacyMedicine.js";
import InsuranceCompany from "../models/InsuranceCompany.js";
import Tpa from "../models/Tpa.js";

function istNow(): Date {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

// ─── Billing day calculation (12 AM IST → 11:59 PM IST, i.e. calendar day) ───
export function computeBillingDays(admissionDate: Date, currentDate = new Date()): number {
  const IST    = 5.5 * 3600000;
  const admDay = Math.floor((admissionDate.getTime() + IST) / 86400000);
  const nowDay = Math.floor((currentDate.getTime() + IST) / 86400000);
  return Math.max(1, nowDay - admDay + 1);
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
  const qty          = Number(data.quantity)   || 1;
  const unitCharge   = Number(data.unitCharge) || 0;
  const discount     = Number(data.discount)   || 0;
  const discountType = data.discountType === "percent" ? "percent" : "flat";
  const grossAmount  = qty * unitCharge;
  const discountAmt  = discountType === "percent" ? grossAmount * discount / 100 : discount;
  const totalCharge  = grossAmount - discountAmt;

  const entry = new IpdBillingEntry({
    ...data,
    patientId,
    quantity:    qty,
    unitCharge,
    discount,
    discountType,
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
  const qty          = data.quantity   !== undefined ? Number(data.quantity)   : existing.quantity;
  const unitCharge   = data.unitCharge !== undefined ? Number(data.unitCharge) : existing.unitCharge;
  const discount     = data.discount   !== undefined ? Number(data.discount)   : existing.discount;
  const discountType = data.discountType !== undefined
    ? (data.discountType === "percent" ? "percent" : "flat")
    : (existing.discountType || "flat");
  const grossAmount  = qty * unitCharge;
  const discountAmt  = discountType === "percent" ? grossAmount * discount / 100 : discount;

  updateData.quantity     = qty;
  updateData.unitCharge   = unitCharge;
  updateData.discount     = discount;
  updateData.discountType = discountType;
  updateData.totalCharge  = grossAmount - discountAmt;

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

// Final due amount remaining on a patient's bill (grand total minus what's
// already been received) — mirrors the calculation on the discharge screen.
async function computeNetDueForPatient(patient: any): Promise<number> {
  const patientId = String(patient._id);
  const [bedSummary, billing, investigations, pharmacy, receiptSummary] = await Promise.all([
    getBedAllotmentSummary(patientId),
    getBillingSummary(patientId),
    getPatientInvestigations(patientId),
    getPharmacyTotal(patientId),
    getReceiptSummary(patientId),
  ]);

  const invTotal = (investigations as any[]).reduce((s, i: any) => s + (i.totalAmount || 0), 0);
  const preDiscTotal = bedSummary.totalBedCharge + billing.gross + invTotal + pharmacy.total - billing.discount;

  const billDisc     = patient.billDiscount || 0;
  const billDiscType = patient.billDiscountType || "flat";
  const billDiscAmt  = billDisc > 0
    ? (billDiscType === "percent" ? preDiscTotal * billDisc / 100 : billDisc)
    : 0;
  const grandTotal = preDiscTotal - billDiscAmt;

  return Math.max(0, grandTotal - receiptSummary.totalReceived - receiptSummary.totalTds - receiptSummary.totalDisallowed);
}

export async function getIpdDashboardStats() {
  // IST calendar-day boundary, computed independent of the server's local timezone.
  const istDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const todayStartUTC = new Date(`${istDate}T00:00:00+05:30`);

  const [currentlyAdmitted, admittedToday, dischargedToday, bedsOccupied, recentRaw, dischargedTodayPatients, receiptsAgg] =
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
      IpdPatient.find(
        { status: "Discharged", dischargeDate: { $gte: todayStartUTC } },
        { _id: 1, billDiscount: 1, billDiscountType: 1 }
      ).lean(),
      IpdReceipt.aggregate([
        { $match: { receiptDate: { $gte: todayStartUTC } } },
        { $group: { _id: null, total: { $sum: "$receiptAmount" } } },
      ]),
    ]);

  // Revenue = receipts collected today + the final due amount left on bills
  // of patients discharged today (recognised at discharge, even if unpaid).
  const receiptsCollectedToday = (receiptsAgg[0]?.total as number) ?? 0;
  const dueAmounts   = await Promise.all(dischargedTodayPatients.map((p: any) => computeNetDueForPatient(p)));
  const finalDueToday = dueAmounts.reduce((s: number, n: number) => s + n, 0);
  const revenueToday  = receiptsCollectedToday + finalDueToday;

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

  return { currentlyAdmitted, admittedToday, dischargedToday, bedsOccupied, recentAdmissions, revenueToday };
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

// ─── Insurance Companies ──────────────────────────────────────────────────────

export async function getInsuranceCompanies(activeOnly = true) {
  const filter: any = activeOnly ? { isActive: true } : {};
  return InsuranceCompany.find(filter).sort({ name: 1 }).lean();
}

export async function createInsuranceCompany(data: any) {
  const company = new InsuranceCompany({
    name:     data.name,
    isActive: data.isActive !== false,
  });
  await company.save();
  return company;
}

export async function updateInsuranceCompany(id: string, data: any) {
  const allowed = ["name", "isActive"];
  const update: any = {};
  allowed.forEach(k => { if (data[k] !== undefined) update[k] = data[k]; });
  return InsuranceCompany.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
}

export async function deleteInsuranceCompany(id: string) {
  return InsuranceCompany.findByIdAndDelete(id).lean();
}

// ─── TPAs ─────────────────────────────────────────────────────────────────────

export async function getTpas(activeOnly = true) {
  const filter: any = activeOnly ? { isActive: true } : {};
  return Tpa.find(filter).sort({ name: 1 }).lean();
}

export async function createTpa(data: any) {
  const tpa = new Tpa({
    name:     data.name,
    isActive: data.isActive !== false,
  });
  await tpa.save();
  return tpa;
}

export async function updateTpa(id: string, data: any) {
  const allowed = ["name", "isActive"];
  const update: any = {};
  allowed.forEach(k => { if (data[k] !== undefined) update[k] = data[k]; });
  return Tpa.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
}

export async function deleteTpa(id: string) {
  return Tpa.findByIdAndDelete(id).lean();
}

// ─── Investigation Items (Catalogue) ─────────────────────────────────────────

export async function getInvestigationItems(vendorCode?: string, activeOnly = true) {
  const filter: any = {};
  if (activeOnly) filter.isActive = true;
  if (vendorCode) filter.vendorCode = vendorCode;
  return InvestigationItem.find(filter).sort({ category: 1, slNo: 1 }).lean();
}

export async function createInvestigationItem(data: any) {
  const item = new InvestigationItem({
    slNo:        data.slNo,
    name:        data.name,
    category:    data.category,
    labRate:     Number(data.labRate)     || 0,
    patientRate: Number(data.patientRate) || 0,
    vendorCode:  data.vendorCode,
    vendorName:  data.vendorName,
    isActive:    data.isActive !== false,
  });
  await item.save();
  return item;
}

export async function updateInvestigationItem(id: string, data: any) {
  const allowed = ["slNo", "name", "category", "labRate", "patientRate", "vendorCode", "vendorName", "isActive"];
  const update: any = {};
  allowed.forEach(k => { if (data[k] !== undefined) update[k] = data[k]; });
  if (update.labRate     !== undefined) update.labRate     = Number(update.labRate)     || 0;
  if (update.patientRate !== undefined) update.patientRate = Number(update.patientRate) || 0;
  return InvestigationItem.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
}

export async function deleteInvestigationItem(id: string) {
  return InvestigationItem.findByIdAndDelete(id).lean();
}

// ─── Bed Allotment ────────────────────────────────────────────────────────────

export async function getBedAllotments(patientId: string) {
  return IpdBedAllotment.find({ patientId }).sort({ allotmentDate: 1, createdAt: 1 }).lean();
}

export async function createBedAllotment(patientId: string, data: any) {
  const patient = await IpdPatient.findById(patientId).lean() as any;
  if (!patient) throw new Error("Patient not found");

  const now = istNow();
  const allotmentDate = data.allotmentDate ? new Date(data.allotmentDate) : now;
  const allotmentTime = data.allotmentTime ||
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // Close off the currently active allotment
  await IpdBedAllotment.updateMany(
    { patientId, isCurrent: true },
    { $set: { isCurrent: false, endDate: allotmentDate, endTime: allotmentTime } }
  );

  const allotment = new IpdBedAllotment({
    patientId,
    admissionId:      patient.admissionId,
    bedCategory:      data.bedCategory,
    bedNo:            data.bedNo,
    charge:           Number(data.charge) || 0,
    allotmentDate,
    allotmentTime,
    effectiveTime:    data.effectiveTime || allotmentTime,
    packageDays:      Number(data.packageDays) || 0,
    includeInPackage: Boolean(data.includeInPackage),
    cashService:      Boolean(data.cashService),
    isCurrent:        true,
    createdBy:        data.createdBy,
  });
  await allotment.save();

  // Update the patient's current bed
  await IpdPatient.findByIdAndUpdate(patientId, {
    $set: { bedCategory: data.bedCategory, bedNo: data.bedNo },
  });

  return allotment;
}

export async function updateBedAllotment(id: string, data: any) {
  const allowed = ["bedCategory", "bedNo", "charge", "allotmentDate", "allotmentTime",
    "endDate", "endTime", "effectiveTime", "effectiveEndTime",
    "packageDays", "includeInPackage", "cashService", "isCurrent"];
  const update: any = {};
  allowed.forEach(k => { if (data[k] !== undefined) update[k] = data[k]; });
  if (update.allotmentDate) update.allotmentDate = new Date(update.allotmentDate);
  if (update.endDate)       update.endDate       = new Date(update.endDate);
  return IpdBedAllotment.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
}

export async function deleteBedAllotment(id: string) {
  return IpdBedAllotment.findByIdAndDelete(id).lean();
}

export async function getBedAllotmentSummary(patientId: string) {
  const allotments = await IpdBedAllotment.find({ patientId }).sort({ allotmentDate: 1 }).lean() as any[];
  const now = new Date();
  let totalBedCharge = 0;
  const details = allotments.map((a: any) => {
    const days = a.endDate
      ? computeBillingDays(new Date(a.allotmentDate), new Date(a.endDate))
      : 1;
    const charge = days * (a.charge || 0);
    totalBedCharge += charge;
    return { ...a, billingDays: days, totalCharge: charge };
  });
  return { allotments: details, totalBedCharge };
}

// ─── Receipt ──────────────────────────────────────────────────────────────────

async function generateReceiptNo(): Promise<string> {
  const now = istNow();
  const year = now.getFullYear();
  const prefix = `RCP${year}`;
  const last = await IpdReceipt.findOne({ receiptNo: { $regex: `^${prefix}` } })
    .sort({ receiptNo: -1 }).lean();
  let serial = 1;
  if (last) {
    const n = parseInt((last as any).receiptNo.slice(prefix.length), 10);
    if (!isNaN(n)) serial = n + 1;
  }
  return `${prefix}${String(serial).padStart(5, "0")}`;
}

export async function getReceipts(patientId: string) {
  return IpdReceipt.find({ patientId }).sort({ receiptDate: 1, createdAt: 1 }).lean();
}

export async function createReceipt(patientId: string, data: any) {
  const patient = await IpdPatient.findById(patientId).lean() as any;
  if (!patient) throw new Error("Patient not found");

  const receiptNo   = await generateReceiptNo();
  const now         = istNow();
  const receiptDate = data.receiptDate ? new Date(data.receiptDate) : now;

  const receipt = new IpdReceipt({
    patientId,
    admissionId:   patient.admissionId,
    receiptNo,
    receiptDate,
    receiptAmount: Number(data.receiptAmount) || 0,
    receiptMode:   data.receiptMode || "CASH",
    remarks:       data.remarks || "",
    tds:           Number(data.tds)        || 0,
    disallowed:    Number(data.disallowed) || 0,
    refund:        Number(data.refund)     || 0,
    chequeNo:      data.chequeNo      || "",
    chequeRefNo:   data.chequeRefNo   || "",
    transactionId: data.transactionId || "",
    createdBy:     data.createdBy     || "",
  });
  await receipt.save();
  return receipt;
}

export async function updateReceipt(id: string, data: any) {
  const allowed = ["receiptDate", "receiptAmount", "receiptMode", "remarks",
    "tds", "disallowed", "refund", "chequeNo", "chequeRefNo", "transactionId"];
  const update: any = {};
  allowed.forEach(k => { if (data[k] !== undefined) update[k] = data[k]; });
  if (update.receiptDate) update.receiptDate = new Date(update.receiptDate);
  if (update.receiptAmount !== undefined) update.receiptAmount = Number(update.receiptAmount) || 0;
  return IpdReceipt.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
}

export async function deleteReceipt(id: string) {
  return IpdReceipt.findByIdAndDelete(id).lean();
}

export async function getReceiptSummary(patientId: string) {
  const receipts = await IpdReceipt.find({ patientId }).lean() as any[];
  const totalReceived  = receipts.reduce((s, r) => s + (r.receiptAmount || 0), 0);
  const totalTds       = receipts.reduce((s, r) => s + (r.tds        || 0), 0);
  const totalDisallowed= receipts.reduce((s, r) => s + (r.disallowed || 0), 0);
  const totalRefund    = receipts.reduce((s, r) => s + (r.refund     || 0), 0);
  return { totalReceived, totalTds, totalDisallowed, totalRefund, count: receipts.length };
}

// ─── Pharmacy Bills ───────────────────────────────────────────────────────────

async function generatePharmacyBillNo(): Promise<string> {
  const now = istNow();
  const year = now.getFullYear();
  const prefix = `PHR${year}`;
  const last = await IpdPharmacyBill.findOne({ billNo: { $regex: `^${prefix}` } })
    .sort({ billNo: -1 }).lean();
  let serial = 1;
  if (last) {
    const n = parseInt((last as any).billNo.slice(prefix.length), 10);
    if (!isNaN(n)) serial = n + 1;
  }
  return `${prefix}${String(serial).padStart(5, "0")}`;
}

export async function getPharmacyBills(patientId: string) {
  return IpdPharmacyBill.find({ patientId }).sort({ billDate: -1, createdAt: -1 }).lean();
}

export async function createPharmacyBill(patientId: string, data: any) {
  const patient = await IpdPatient.findById(patientId).lean() as any;
  if (!patient) throw new Error("Patient not found");
  const billNo = await generatePharmacyBillNo();
  const items = (data.items || []).map((it: any) => {
    const qty      = Number(it.qty)      || 0;
    const mrp      = Number(it.mrp)      || 0;
    const disc     = Number(it.discount) || 0;
    const discType = it.discountType === "₹" ? "₹" : "%";
    const total    = qty * mrp;
    const net      = discType === "₹" ? Math.max(0, total - disc) : total - (total * disc / 100);
    return { ...it, qty, mrp, discount: disc, discountType: discType, totalAmount: total, netAmount: Math.max(0, net) };
  });
  const totalAmount = items.reduce((s: number, i: any) => s + i.totalAmount, 0);
  const netAmount   = items.reduce((s: number, i: any) => s + i.netAmount,   0);
  const bill = new IpdPharmacyBill({
    patientId,
    admissionId: patient.admissionId,
    billNo,
    billDate:     data.billDate     ? new Date(data.billDate) : istNow(),
    referredBy:   data.referredBy   || "",
    vendor:       data.vendor       || "",
    vendorBillNo: data.vendorBillNo || "",
    items,
    totalAmount,
    netAmount,
  });
  await bill.save();
  return bill;
}

export async function updatePharmacyBill(id: string, data: any) {
  const allowed = ["billDate", "referredBy", "vendor", "vendorBillNo", "items"];
  const update: any = {};
  allowed.forEach(k => { if (data[k] !== undefined) update[k] = data[k]; });
  if (update.billDate) update.billDate = new Date(update.billDate);
  if (update.items) {
    update.items = update.items.map((it: any) => {
      const qty   = Number(it.qty)   || 0;
      const mrp   = Number(it.mrp)   || 0;
      const disc     = Number(it.discount) || 0;
      const discType = it.discountType === "₹" ? "₹" : "%";
      const total    = qty * mrp;
      const net      = discType === "₹" ? Math.max(0, total - disc) : total - (total * disc / 100);
      return { ...it, qty, mrp, discount: disc, discountType: discType, totalAmount: total, netAmount: Math.max(0, net) };
    });
    update.totalAmount = update.items.reduce((s: number, i: any) => s + i.totalAmount, 0);
    update.netAmount   = update.items.reduce((s: number, i: any) => s + i.netAmount,   0);
  }
  return IpdPharmacyBill.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
}

export async function deletePharmacyBill(id: string) {
  return IpdPharmacyBill.findByIdAndDelete(id).lean();
}

export async function getPharmacyTotal(patientId: string) {
  const bills = await IpdPharmacyBill.find({ patientId }).lean() as any[];
  const total = bills.reduce((s, b) => s + (b.netAmount || 0), 0);
  return { total, count: bills.length };
}

// ─── Pharmacy Medicine Catalog ────────────────────────────────────────────────

export async function getMedicines(activeOnly = true) {
  const filter: any = activeOnly ? { isActive: true } : {};
  return PharmacyMedicine.find(filter).sort({ termName: 1 }).lean();
}

export async function createMedicine(data: any) {
  const count = await PharmacyMedicine.countDocuments();
  const itemCode = data.itemCode || String(5000000 + count + 1);
  const med = new PharmacyMedicine({
    itemCode,
    termName:     data.termName     || "",
    unitName:     data.unitName     || "",
    packingPower: data.packingPower || "",
    boxNo:        data.boxNo        || "",
    mrp:          Number(data.mrp)  || 0,
    isActive:     data.isActive !== false,
  });
  await med.save();
  return med;
}

export async function updateMedicine(id: string, data: any) {
  const allowed = ["termName", "unitName", "packingPower", "boxNo", "mrp", "isActive"];
  const update: any = {};
  allowed.forEach(k => { if (data[k] !== undefined) update[k] = data[k]; });
  if (update.mrp !== undefined) update.mrp = Number(update.mrp) || 0;
  return PharmacyMedicine.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
}

export async function deleteMedicine(id: string) {
  return PharmacyMedicine.findByIdAndDelete(id).lean();
}

