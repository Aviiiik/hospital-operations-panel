import api from "@/lib/Api";

// ─── Vendor types ─────────────────────────────────────────────────────────────

export interface InvestigationVendor {
  _id: string;
  code: string;
  name: string;
  isActive: boolean;
}

// ─── Insurance Company / TPA types ────────────────────────────────────────────

export interface InsuranceCompany {
  _id: string;
  name: string;
  isActive: boolean;
}

export interface Tpa {
  _id: string;
  name: string;
  isActive: boolean;
}

// ─── Investigation Item (catalogue) types ─────────────────────────────────────

export interface InvestigationItem {
  _id: string;
  slNo: number;
  name: string;
  category: string;
  labRate: number;
  patientRate: number;
  vendorCode: string;
  vendorName: string;
  isActive: boolean;
}

// ─── Service catalogue types ──────────────────────────────────────────────────

export interface CatalogueService {
  _id?: string;
  name: string;
  unit: string;
  defaultCharge: number;
  requiresDoctor?: boolean;
  isReferral?: boolean;
}

export interface ServiceGroup {
  code: string;
  name: string;
  services: CatalogueService[];
  allowCustom?: boolean;
}

// Full catalogue document as stored/returned by the admin CRUD endpoints
// (getServiceCatalogue/create/update/deleteServiceCatalogueItem below).
export interface ServiceCatalogueEntry {
  _id: string;
  serviceGroup: string;
  serviceGroupCode: string;
  serviceName: string;
  unit: string;
  defaultCharge: number;
  requiresDoctor: boolean;
  isReferral: boolean;
  isActive: boolean;
  sortOrder: number;
}

// ─── Static fallback catalogue (used while API loads) ─────────────────────────
// Groups that allow custom entries but have no fixed services are listed here
// so the UI can still show those group buttons immediately.

export const SERVICE_GROUP_META: { code: string; name: string; allowCustom: boolean }[] = [
  { code: "24",  name: "RGST CHARGES",   allowCustom: false },
  { code: "004", name: "WARD",           allowCustom: true  },
  { code: "10",  name: "CONSULTATION",   allowCustom: false },
  { code: "29",  name: "BLOOD",          allowCustom: false },
  { code: "003", name: "OT CHARGES",     allowCustom: false },
  { code: "30",  name: "PHYSIOTHERAPY",  allowCustom: false },
  { code: "11",  name: "PROCEDURE",      allowCustom: true  },
  { code: "23",  name: "SURGEON FEES",   allowCustom: false },
  { code: "28",  name: "OTHERS CHARGES", allowCustom: true  },
  { code: "12",  name: "HEMODIALYSIS",   allowCustom: false },
  { code: "21",  name: "ATTENDANT",      allowCustom: true  },
  { code: "22",  name: "ATTENDANT SPL",  allowCustom: true  },
  { code: "31",  name: "CHEMOTHERAPY",   allowCustom: true  },
  { code: "007", name: "PHARMACY",       allowCustom: true  },
  { code: "001", name: "GENERAL",        allowCustom: true  },
];

// Build SERVICE_GROUPS from API items + group meta. Groups present in the
// catalogue data but not in the static SERVICE_GROUP_META list (i.e. new
// groups created from the Service Catalogue admin page) are appended too,
// so a freshly-added group is usable for billing right away.
export function buildServiceGroups(
  apiItems: Array<{
    _id: string; serviceGroup: string; serviceGroupCode: string;
    serviceName: string; unit: string; defaultCharge: number;
    requiresDoctor?: boolean; isReferral?: boolean;
  }>
): ServiceGroup[] {
  const toService = (i: (typeof apiItems)[number]): CatalogueService => ({
    _id:            i._id,
    name:           i.serviceName,
    unit:           i.unit,
    defaultCharge:  i.defaultCharge,
    requiresDoctor: i.requiresDoctor,
    isReferral:     i.isReferral,
  });

  const metaGroups = SERVICE_GROUP_META.map(meta => ({
    code: meta.code,
    name: meta.name,
    services: apiItems
      .filter(i => i.serviceGroupCode === meta.code || i.serviceGroup === meta.name)
      .map(toService),
    allowCustom: meta.allowCustom,
  }));

  const metaCodes = new Set(SERVICE_GROUP_META.map(m => m.code));
  const metaNames = new Set(SERVICE_GROUP_META.map(m => m.name));
  const extraGroups = new Map<string, ServiceGroup>();
  apiItems.forEach(i => {
    if (metaCodes.has(i.serviceGroupCode) || metaNames.has(i.serviceGroup)) return;
    const key = i.serviceGroupCode || i.serviceGroup;
    if (!extraGroups.has(key)) {
      extraGroups.set(key, { code: i.serviceGroupCode, name: i.serviceGroup, services: [], allowCustom: true });
    }
    extraGroups.get(key)!.services.push(toService(i));
  });

  return [...metaGroups, ...extraGroups.values()];
}

// ─── Billing day calculation (day 1 ends noon next day, then noon-to-noon) ───
// Day 1 runs from the exact admission/allotment instant until 12:00 PM IST
// of the calendar day immediately after the admission date — regardless of
// what time on that admission date the patient was admitted. Day 2 begins
// right after that noon, and every following noon crossed adds one more day.
//
//   Admitted 9 PM Sep 1 → day 1 ends 12 PM Sep 2 → day 2 starts 12 PM Sep 2
//                        → day 3 starts 12 PM Sep 3 …
//   Admitted 9 AM Sep 1 → day 1 ends 12 PM Sep 2 → day 2 starts 12 PM Sep 2
//                        → day 3 starts 12 PM Sep 3 …
export function computeBillingDays(admissionDate: Date | string, currentDate = new Date()): number {
  const adm = typeof admissionDate === "string" ? new Date(admissionDate) : admissionDate;
  const IST  = 5.5 * 3600000;
  const NOON = 12 * 3600000;
  const DAY  = 86400000;
  // Start of the admission's IST calendar day, in IST wall-clock ("shifted") ms.
  const admDayStart = Math.floor((adm.getTime() + IST) / DAY) * DAY;
  // 12:00 PM IST of the day after admission, converted back to a real instant.
  const firstNoon = admDayStart + DAY + NOON - IST;
  if (currentDate.getTime() < firstNoon) return 1;
  const extraDays = Math.floor((currentDate.getTime() - firstNoon) / DAY);
  return 2 + extraDays;
}

// ─── Per-section discount breakdown for the Bill Summary ──────────────────────
// Total discount per billing section (Services / Investigation / Pharmacy) —
// section-level only, no line-item / item-name detail.
// Bed allotments carry no discount field, so there is never a bed row.
// Shared by IpdBilling, IpdReceipt and IpdDischarge so all three always agree.
//
//  - serviceEntries: billing entries ({ unitCharge, quantity, totalCharge }).
//      Pass [] when only an aggregate services discount is available (IpdDischarge)
//      and supply it via `servicesDiscountFallback`.
//  - investigations: [{ items: [{ amount, netAmount }] }] — discount = amount − netAmount.
//  - pharmBills:      [{ items: [{ mrp, qty, netAmount }], billDiscount, billDiscountType }]
//      discount = Σ(mrp×qty − item.netAmount) + the bill-level discount.
export interface IpdDiscountSection {
  section: string;
  total: number;
}

export function buildDiscountSections(
  serviceEntries: any[],
  investigations: any[],
  pharmBills: any[],
  servicesDiscountFallback = 0,
): IpdDiscountSection[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sections: IpdDiscountSection[] = [];

  // Services — sum of every entry's discount, or the aggregate fallback
  const svcDisc = (serviceEntries || []).reduce((s, e) => {
    const disc = (Number(e.unitCharge) || 0) * (Number(e.quantity) || 0) - (Number(e.totalCharge) || 0);
    return s + (disc > 0 ? disc : 0);
  }, 0);
  const servicesTotal = svcDisc > 0.001 ? svcDisc : (servicesDiscountFallback > 0.001 ? servicesDiscountFallback : 0);
  if (servicesTotal > 0.001) sections.push({ section: "Services", total: r2(servicesTotal) });

  // Investigation — sum of (lab amount − net) across every requisition item
  const invDisc = (investigations || []).reduce((s, inv) =>
    s + (inv.items || []).reduce((si: number, it: any) => {
      const disc = (Number(it.amount) || 0) - (Number(it.netAmount) || 0);
      return si + (disc > 0 ? disc : 0);
    }, 0), 0);
  if (invDisc > 0.001) sections.push({ section: "Investigation", total: r2(invDisc) });

  // Pharmacy — sum of (MRP × qty − net) across every bill item, plus each bill's
  // bill-level discount (flat ₹ or % of the item-net subtotal).
  const pharmDisc = (pharmBills || []).reduce((s, b) => {
    const items = b.items || [];
    const itemDisc = items.reduce((si: number, it: any) => {
      const gross = (parseFloat(String(it.mrp)) || 0) * (parseFloat(String(it.qty)) || 0);
      const disc = gross - (Number(it.netAmount) || 0);
      return si + (disc > 0 ? disc : 0);
    }, 0);
    const itemsNet = items.reduce((si: number, it: any) => si + (Number(it.netAmount) || 0), 0);
    const bd = Number(b.billDiscount) || 0;
    const billDisc = bd <= 0 ? 0 : (b.billDiscountType === "%" ? itemsNet * bd / 100 : bd);
    return s + itemDisc + billDisc;
  }, 0);
  if (pharmDisc > 0.001) sections.push({ section: "Pharmacy", total: r2(pharmDisc) });

  return sections;
}

// ─── IST-aware "today" / "now" helpers ────────────────────────────────────────
// `new Date().toISOString()` always returns the UTC calendar day, which lags
// India by 5.5 hours — between 00:00–05:29 IST it silently returns *yesterday's*
// date. These helpers force IST regardless of the machine's configured
// timezone, so "today"/"now" defaults across IPD forms always match the
// India calendar day/clock.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function nowISTTime(): string {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`;
}

// Converts any Date/ISO timestamp to its IST calendar date (YYYY-MM-DD) —
// use when re-deriving a date-only string from a stored timestamp that may
// carry a real time-of-day component.
export function toISTDateStr(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Date(dt.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// Combines a stored date-only value with a separate "HH:MM" time-of-day
// string (e.g. bed allotment's allotmentTime/endTime) into the actual IST
// instant. Use this before computeBillingDays() whenever a record tracks its
// clock time separately from its date — otherwise the noon-to-noon cutoff
// only ever sees the date's stored UTC-midnight timestamp and never reflects
// the real time the allotment/discharge actually happened at.
export function combineISTDateTime(d: Date | string, time?: string): Date {
  const dateStr = toISTDateStr(d);
  const [h, m] = (time || "00:00").split(":").map(n => parseInt(n, 10) || 0);
  return new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - IST_OFFSET_MS + h * 3600000 + m * 60000);
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const BED_CATEGORIES = [
  { category: "ICCU",                            beds: ["ICCU-1", "ICCU-2", "ICCU-3", "ICCU-4"] },
  { category: "Single Bed AC Cabin",             beds: ["209", "309"] },
  { category: "Suite Deluxe Cabin AC",           beds: ["S1", "S2", "S3", "S4"] },
  { category: "Economy General Bed (Female)",    beds: ["310"] },
  { category: "Double Bed AC Cabin",             beds: ["203", "204", "303", "304"] },
  { category: "Economy General Bed (Male)",      beds: ["210"] },
  { category: "Four Bed General Bed (AC) Male",  beds: ["205", "206", "207", "208"] },
  { category: "Single Bed AC Cabin Large",       beds: ["201", "202", "301", "302"] },
  { category: "Four Bed General Bed (AC) Female",beds: ["305", "306", "307", "308"] },
];

export const BLOOD_GROUPS        = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const DIET_TYPES          = ["General", "Diabetic", "Low Salt", "Liquid", "Soft", "NPO"];
export const TREATMENT_CATEGORIES= ["General", "Surgical", "Maternity", "ICU", "Emergency", "Paediatric", "Gynaecology", "Orthopaedic"];
export const PATIENT_CATEGORIES  = ["General", "TPA", "Cash", "Insurance", "ESI", "CGHS"];
export const IPD_DEPARTMENTS     = ["OPD", "IPD", "DAYCARE", "MEDICINE", "SURGERY", "GYNAECOLOGY", "ORTHOPAEDIC", "PAEDIATRIC", "ICU", "DIALYSIS", "ENT", "OPHTHALMOLOGY", "DERMATOLOGY", "NEUROLOGY", "CARDIOLOGY", "UROLOGY", "MATERNITY"];
export const DISCHARGE_TYPES     = ["Recovered", "Referred", "LAMA", "Absconded", "Death", "Transferred","Normal","DORB"];

// Departments that never incur bed charges (patient isn't occupying an IPD bed)
export const BED_CHARGE_EXEMPT_DEPARTMENTS = ["OPD", "DAYCARE"];
export function isBedChargeExempt(department?: string | null): boolean {
  return !!department && BED_CHARGE_EXEMPT_DEPARTMENTS.includes(department.toUpperCase());
}

export const BED_CHARGES: Record<string, number> = {
  "ICCU":                              5000,
  "Single Bed AC Cabin":               2700,
  "Suite Deluxe Cabin AC":             4000,
  "Economy General Bed (Female)":      1900,
  "Double Bed AC Cabin":               2100,
  "Economy General Bed (Male)":        1900,
  "Four Bed General Bed (AC) Male":    1500,
  "Single Bed AC Cabin Large":         3000,
  "Four Bed General Bed (AC) Female":  1500,
};

export const RECEIPT_MODES = ["CASH", "CHEQUE", "NEFT", "UPI", "CARD-DR/CR", "DD"];

// ─── API calls ────────────────────────────────────────────────────────────────

const ipdService = {
  getDashboardStats: (from?: string, to?: string) => api.get("/ipd/stats", { params: { from, to } }),
  getNextId:      ()           => api.get("/ipd/patients/next-id"),
  createPatient:  (data: any)  => api.post("/ipd/patients", data),
  searchPatients: (params: any)=> api.get("/ipd/patients", { params }),
  getPatient:     (id: string) => api.get(`/ipd/patients/${id}`),
  updatePatient:  (id: string, data: any) => api.put(`/ipd/patients/${id}`, data),
  deletePatient:  (id: string) => api.delete(`/ipd/patients/${id}`),
  getOccupiedBeds: ()          => api.get("/ipd/beds/occupied"),

  // Investigations
  getInvestigations:    (patientId: string)              => api.get(`/ipd/investigations/patient/${patientId}`),
  createInvestigation:  (patientId: string, data: any)   => api.post(`/ipd/investigations/patient/${patientId}`, data),
  updateInvestigation:  (id: string, data: any)          => api.put(`/ipd/investigations/${id}`, data),
  deleteInvestigation:  (id: string)                     => api.delete(`/ipd/investigations/${id}`),

  // Billing
  getBillingEntries:    (patientId: string)              => api.get(`/ipd/billing/${patientId}`),
  getBillingSummary:    (patientId: string)              => api.get(`/ipd/billing/${patientId}/summary`),
  createBillingEntry:   (patientId: string, data: any)   => api.post(`/ipd/billing/${patientId}`, data),
  updateBillingEntry:   (id: string, data: any)          => api.put(`/ipd/billing/entry/${id}`, data),
  deleteBillingEntry:   (id: string)                     => api.delete(`/ipd/billing/entry/${id}`),

  // Vendors
  getVendors:    (all = false) => api.get("/ipd/vendors", { params: all ? { all: "1" } : {} }),
  createVendor:  (data: any)   => api.post("/ipd/vendors", data),
  updateVendor:  (id: string, data: any) => api.put(`/ipd/vendors/${id}`, data),
  deleteVendor:  (id: string)  => api.delete(`/ipd/vendors/${id}`),

  // Insurance Companies
  getInsuranceCompanies:    (all = false) => api.get("/ipd/insurance-companies", { params: all ? { all: "1" } : {} }),
  createInsuranceCompany:   (data: any)   => api.post("/ipd/insurance-companies", data),
  updateInsuranceCompany:   (id: string, data: any) => api.put(`/ipd/insurance-companies/${id}`, data),
  deleteInsuranceCompany:   (id: string)  => api.delete(`/ipd/insurance-companies/${id}`),

  // TPAs
  getTpas:    (all = false) => api.get("/ipd/tpas", { params: all ? { all: "1" } : {} }),
  createTpa:  (data: any)   => api.post("/ipd/tpas", data),
  updateTpa:  (id: string, data: any) => api.put(`/ipd/tpas/${id}`, data),
  deleteTpa:  (id: string)  => api.delete(`/ipd/tpas/${id}`),

  // Investigation Items (catalogue)
  getInvestigationItems:    (vendorCode?: string, all = false) =>
    api.get("/ipd/investigation-items", { params: { ...(all ? { all: "1" } : {}), ...(vendorCode ? { vendorCode } : {}) } }),
  createInvestigationItem:  (data: any)   => api.post("/ipd/investigation-items", data),
  updateInvestigationItem:  (id: string, data: any) => api.put(`/ipd/investigation-items/${id}`, data),
  deleteInvestigationItem:  (id: string)  => api.delete(`/ipd/investigation-items/${id}`),

  // Service Catalogue
  getServiceCatalogue:        (all = false) => api.get("/ipd/service-catalogue", { params: all ? { all: "1" } : {} }),
  createServiceCatalogueItem: (data: any)   => api.post("/ipd/service-catalogue", data),
  updateServiceCatalogueItem: (id: string, data: any) => api.put(`/ipd/service-catalogue/${id}`, data),
  deleteServiceCatalogueItem: (id: string)  => api.delete(`/ipd/service-catalogue/${id}`),

  // Bed Allotments
  getBedAllotments:        (patientId: string)             => api.get(`/ipd/bed-allotments/${patientId}`),
  getBedAllotmentSummary:  (patientId: string)             => api.get(`/ipd/bed-allotments/${patientId}/summary`),
  createBedAllotment:      (patientId: string, data: any)  => api.post(`/ipd/bed-allotments/${patientId}`, data),
  updateBedAllotment:      (id: string, data: any)         => api.put(`/ipd/bed-allotments/entry/${id}`, data),
  deleteBedAllotment:      (id: string)                    => api.delete(`/ipd/bed-allotments/entry/${id}`),

  // Receipts
  getReceipts:       (patientId: string)             => api.get(`/ipd/receipts/${patientId}`),
  getReceiptSummary: (patientId: string)             => api.get(`/ipd/receipts/${patientId}/summary`),
  createReceipt:     (patientId: string, data: any)  => api.post(`/ipd/receipts/${patientId}`, data),
  updateReceipt:     (id: string, data: any)         => api.put(`/ipd/receipts/entry/${id}`, data),
  deleteReceipt:     (id: string)                    => api.delete(`/ipd/receipts/entry/${id}`),

  // Pharmacy Bills
  getPharmacyBills:   (patientId: string)            => api.get(`/ipd/pharmacy/${patientId}`),
  getPharmacyTotal:   (patientId: string)            => api.get(`/ipd/pharmacy/${patientId}/total`),
  createPharmacyBill: (patientId: string, data: any) => api.post(`/ipd/pharmacy/${patientId}`, data),
  updatePharmacyBill: (id: string, data: any)        => api.put(`/ipd/pharmacy/bill/${id}`, data),
  deletePharmacyBill: (id: string)                   => api.delete(`/ipd/pharmacy/bill/${id}`),
  // Medicine Catalog
  getMedicines:    (all = false) => api.get("/ipd/pharmacy-medicines", { params: all ? { all: "1" } : {} }),
  createMedicine:  (data: any)   => api.post("/ipd/pharmacy-medicines", data),
  updateMedicine:  (id: string, data: any) => api.put(`/ipd/pharmacy-medicines/${id}`, data),
  deleteMedicine:  (id: string)  => api.delete(`/ipd/pharmacy-medicines/${id}`),

};

export default ipdService;
