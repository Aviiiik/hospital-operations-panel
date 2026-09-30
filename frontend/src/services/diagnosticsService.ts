import api from "@/lib/Api";

export const PAYMENT_MODES = ["Cash", "Card", "UPI", "Other"];

// Departments on the hospital's diagnostics rate sheets. Test Catalogue offers
// these; add to this list to introduce a new one.
export const DIAGNOSTIC_DEPARTMENTS = ["RADIOLOGY", "CARDIOLOGY"];

export interface DiagnosticTestRow {
  testName: string;
  department?: string;
  charge: number;
}

export interface DiagnosticTestItem {
  _id: string;
  testName: string;
  department: string;
  charge: number;
  isActive: boolean;
  sortOrder: number;
}

// One doc is the patient AND their one bill — see backend model comment.
export interface DiagnosticPatient {
  _id: string;
  title: string;
  name: string;
  gender: string;
  dob?: string;
  ageYears: number;
  ageMonths?: number;
  ageDays?: number;
  nationality?: string;
  religion?: string;
  caste?: string;
  occupation?: string;
  address?: string;
  postOffice?: string;
  policeStation?: string;
  district?: string;
  state?: string;
  pin?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  city?: string;
  country?: string;
  referredBy?: string;
  collCentre?: string;
  organization?: string;
  patientHistory?: string;
  registrationDate: string;

  billNo: string;           // "00001/2026" — the only number in Diagnostics
  billDate: string;
  tests: DiagnosticTestRow[];
  totalAmount: number;
  discount: number;         // percent
  discountAmount: number;
  billAmount: number;
  paymentMode: string;
  billRemarks?: string;
  createdAt: string;
}

export interface DiagnosticsDashboardStats {
  patients: { current: number; previous: number };
  revenue:  { current: number; previous: number };
  discount: number;
  byDepartment:  { department: string; tests: number; amount: number }[];
  topTests:      { testName: string; department: string; count: number; amount: number }[];
  byPaymentMode: { paymentMode: string; count: number; amount: number }[];
  recentBills: Pick<DiagnosticPatient, "_id" | "title" | "name" | "billNo" | "billDate" | "tests" | "billAmount" | "paymentMode">[];
}

const diagnosticsService = {
  getDashboardStats: (from?: string, to?: string) => api.get("/diagnostics/stats/dashboard", { params: { from, to } }),
  getNextBillNo:  ()                      => api.get("/diagnostics/next-bill-no"),

  createPatient:  (data: any)             => api.post("/diagnostics/patients", data),
  updatePatient:  (id: string, data: any) => api.put(`/diagnostics/patients/${id}`, data),
  searchPatients: (params: any)           => api.get("/diagnostics/patients", { params }),
  getPatient:     (id: string)            => api.get(`/diagnostics/patients/${id}`),
  deletePatient:  (id: string)            => api.delete(`/diagnostics/patients/${id}`),

  getTests:       (all = false)           => api.get("/diagnostics/tests", { params: all ? { all: "1" } : {} }),
  createTest:     (data: any)             => api.post("/diagnostics/tests", data),
  updateTest:     (id: string, data: any) => api.put(`/diagnostics/tests/${id}`, data),
  deleteTest:     (id: string)            => api.delete(`/diagnostics/tests/${id}`),
};

export default diagnosticsService;
