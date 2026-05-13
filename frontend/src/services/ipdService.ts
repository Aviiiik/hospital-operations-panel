import api from "@/lib/Api";

// ─── Vendor types ─────────────────────────────────────────────────────────────

export interface InvestigationVendor {
  _id: string;
  code: string;
  name: string;
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

// Build SERVICE_GROUPS from API items + group meta
export function buildServiceGroups(
  apiItems: Array<{
    _id: string; serviceGroup: string; serviceGroupCode: string;
    serviceName: string; unit: string; defaultCharge: number;
    requiresDoctor?: boolean; isReferral?: boolean;
  }>
): ServiceGroup[] {
  return SERVICE_GROUP_META.map(meta => {
    const services: CatalogueService[] = apiItems
      .filter(i => i.serviceGroupCode === meta.code || i.serviceGroup === meta.name)
      .map(i => ({
        _id:           i._id,
        name:          i.serviceName,
        unit:          i.unit,
        defaultCharge: i.defaultCharge,
        requiresDoctor:i.requiresDoctor,
        isReferral:    i.isReferral,
      }));
    return { code: meta.code, name: meta.name, services, allowCustom: meta.allowCustom };
  });
}

// ─── Billing day calculation (12 AM IST → 11:59 PM IST, i.e. calendar day) ───
export function computeBillingDays(admissionDate: Date | string, currentDate = new Date()): number {
  const adm = typeof admissionDate === "string" ? new Date(admissionDate) : admissionDate;
  const IST    = 5.5 * 3600000;
  const admDay = Math.floor((adm.getTime() + IST) / 86400000);
  const nowDay = Math.floor((currentDate.getTime() + IST) / 86400000);
  return Math.max(1, nowDay - admDay + 1);
}

// ─── Doctor list ──────────────────────────────────────────────────────────────

export const IPD_REFERRAL_DOCTORS = [
  { code: "004", name: "DEBARCHAN GHOSH",             speciality: "SURGEON" },
  { code: "048", name: "A. K. KHAITAN",               speciality: "PSYCHIATRY" },
  { code: "068", name: "ABHIJIT MONDAL",              speciality: "" },
  { code: "010", name: "ACHYUT ROY CHOUDHURI",        speciality: "ANESTHETIST" },
  { code: "052", name: "AMITAVA DAS (SPECIALIST)",    speciality: "CARDIOLOGIST" },
  { code: "006", name: "ANISH HAZRA",                 speciality: "" },
  { code: "019", name: "ANUVAB GOSWAMI",              speciality: "" },
  { code: "067", name: "ANWESHA CHAKRABORTY",         speciality: "" },
  { code: "015", name: "ARCOJIT GHOSH",               speciality: "" },
  { code: "012", name: "ARJUN ROY",                   speciality: "NEPHROLOGIST" },
  { code: "034", name: "ARPITA SARKAR",               speciality: "" },
  { code: "025", name: "AVISHEK JAISWAL",             speciality: "" },
  { code: "050", name: "BARUN PRAMANIK",              speciality: "PHYSIOTHERAPY" },
  { code: "002", name: "BHASKAR SINHA",               speciality: "GENERAL" },
  { code: "043", name: "CHANDRANEEL SAHA",            speciality: "ANESTHETIST" },
  { code: "021", name: "D. J. BHAUMIK",               speciality: "MBBS, MS" },
  { code: "033", name: "DEBANIK SARKAR",              speciality: "" },
  { code: "061", name: "DEBARCHAN GHOSH (SPECIALIST)",speciality: "SURGEON" },
  { code: "013", name: "DEEP DAS (SPECIALIST)",       speciality: "NEUROLOGIST" },
  { code: "042", name: "DR. ARDHENDU SEKHAR PANDIT",  speciality: "" },
  { code: "055", name: "EMERGENCY MANAGEMENT CARE",   speciality: "" },
  { code: "063", name: "GOURAB BANERJEE",             speciality: "" },
  { code: "062", name: "GOURAV BANERJEE",             speciality: "" },
  { code: "001", name: "GOUTAM GHOSH",                speciality: "GENERAL" },
  { code: "059", name: "HIMADRI SEKHAR CHAKRABORTY",  speciality: "ANESTHETIST" },
  { code: "049", name: "INDRANEEL SAHA",              speciality: "GASTROINTESTINAL" },
  { code: "008", name: "INITIAL MANAGEMENT CHARGES",  speciality: "" },
  { code: "009", name: "K. C. MALLICK",               speciality: "" },
  { code: "014", name: "LALTU CHANDA",                speciality: "PHYSIOTHERAPY" },
  { code: "070", name: "MALOY KUMAR BERA",            speciality: "" },
  { code: "047", name: "MANOJ KUMAR ADAK",            speciality: "ANESTHETIST" },
  { code: "060", name: "MD. BASIR AHAMED",            speciality: "" },
  { code: "011", name: "MONICA SHAH",                 speciality: "GYNAECOLOGIST" },
  { code: "045", name: "MUKESH KUMAR VIJAY",          speciality: "UROLOGIST & GEN. SURGEON" },
  { code: "069", name: "NILADRI SEKHAR MUKHERJEE",    speciality: "ANESTHETIST" },
  { code: "023", name: "NIRDESH TIWARI",              speciality: "" },
  { code: "035", name: "P.K.PUJARI",                  speciality: "" },
  { code: "030", name: "PIYALI CHATTOPADHYAY",        speciality: "GYNAECOLOGIST" },
  { code: "053", name: "PRANJAL SARKAR",              speciality: "" },
  { code: "073", name: "PREETI VIJAY",                speciality: "GYNAECOLOGIST & OBSTERTRICIAN" },
  { code: "066", name: "PREETY VIJAY",                speciality: "GYNAECOLOGIST" },
  { code: "007", name: "RAJESH JINDEL",               speciality: "ONCOLOGY" },
  { code: "040", name: "RESHMI DUTTA SARKAR",         speciality: "" },
  { code: "065", name: "RICK BANERJEE",               speciality: "PULMONOLOGIST" },
  { code: "028", name: "SAIKAT SARKAR",               speciality: "" },
  { code: "031", name: "SANDIP BHATTACHRYA",          speciality: "" },
  { code: "017", name: "SANJAY SEN",                  speciality: "ORTHOPAEDIC SURGEON" },
  { code: "046", name: "SANKHADIP PRAMANIK",          speciality: "" },
  { code: "056", name: "SASHI JINDEL",                speciality: "GYNAECOLOGIST" },
  { code: "024", name: "SIDHARTH DAS",                speciality: "" },
  { code: "026", name: "SK.M. A.UDDIN",               speciality: "" },
  { code: "064", name: "SOUGATA BHATTACHARYA",        speciality: "" },
  { code: "020", name: "SOUMYA DAS",                  speciality: "PULMONOLOGIST" },
  { code: "005", name: "SOUMYA GAYEN",                speciality: "" },
  { code: "072", name: "SOUMYADIP GUPTA",             speciality: "ANESTHETIST" },
  { code: "018", name: "SOURAV BASU",                 speciality: "ANESTHETIST" },
  { code: "032", name: "SREEMANTI BAG",               speciality: "" },
  { code: "044", name: "SUBHADIP PAL",                speciality: "" },
  { code: "041", name: "SUBIR PAUL",                  speciality: "PAEDIATRIC SURGEON" },
  { code: "058", name: "SUMIT GOSWAMI",               speciality: "ANESTHETIST" },
  { code: "051", name: "SUPARNA DAS",                 speciality: "SPEACH THERAPIST" },
  { code: "016", name: "TAPAS LAHA",                  speciality: "" },
  { code: "054", name: "VIDAGDHAMAY BISWAS",          speciality: "ANESTHETIST" },
  { code: "057", name: "VIPIN KATIYAR",               speciality: "UROLOGIST & GEN. SURGEON" },
];

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
export const IPD_DEPARTMENTS     = ["MEDICINE", "SURGERY", "GYNAECOLOGY", "ORTHOPAEDIC", "PAEDIATRIC", "ICU", "DIALYSIS", "ENT", "OPHTHALMOLOGY", "DERMATOLOGY", "NEUROLOGY", "CARDIOLOGY", "UROLOGY", "MATERNITY"];
export const DISCHARGE_TYPES     = ["Recovered", "Referred", "LAMA", "Absconded", "Death", "Transferred"];

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

export const RECEIPT_MODES = ["CASH", "CHEQUE", "NEFT", "UPI", "CARD", "DD"];

// ─── API calls ────────────────────────────────────────────────────────────────

const ipdService = {
  getDashboardStats: ()           => api.get("/ipd/stats"),
  getNextId:      ()           => api.get("/ipd/patients/next-id"),
  createPatient:  (data: any)  => api.post("/ipd/patients", data),
  searchPatients: (params: any)=> api.get("/ipd/patients", { params }),
  getPatient:     (id: string) => api.get(`/ipd/patients/${id}`),
  updatePatient:  (id: string, data: any) => api.put(`/ipd/patients/${id}`, data),
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
