import DiagnosticPatient from "../models/DiagnosticPatient.js";
import DiagnosticTest from "../models/DiagnosticTest.js";

// Current calendar year in IST (VPS runs UTC so we must convert).
function istYear(): number {
  return Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 4));
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Highest existing serial for the year + 1 (not count + 1 — a deleted patient
// would otherwise make count + 1 collide with a still-existing bill forever).
async function getNextBillSerial(year: number): Promise<number> {
  const last = await DiagnosticPatient.findOne({ billYear: year }, { billSerial: 1 }).sort({ billSerial: -1 });
  return last ? last.billSerial + 1 : 1;
}

export function formatBillNo(serial: number, year: number) {
  return `${String(serial).padStart(5, "0")}/${year}`;
}

type TestRow = { testName: string; department: string; charge: number };

function cleanTests(raw: any): TestRow[] {
  const tests = (Array.isArray(raw) ? raw : [])
    .map((t: any) => ({
      testName:   String(t?.testName || "").trim(),
      department: String(t?.department || "").trim().toUpperCase(),
      charge:     Number(t?.charge) || 0,
    }))
    .filter((t: any) => t.testName);
  if (!tests.length) throw new Error("At least one test is required");
  return tests;
}

function computeBillAmounts(tests: TestRow[], discountPct: number) {
  const totalAmount    = r2(tests.reduce((s, t) => s + t.charge, 0));
  const discount        = Math.min(100, Math.max(0, Number(discountPct) || 0));
  const discountAmount  = r2(totalAmount * discount / 100);
  const billAmount      = r2(Math.max(0, totalAmount - discountAmount));
  return { totalAmount, discount, discountAmount, billAmount };
}

export async function getNextBillNo() {
  const year = istYear();
  return { billNo: formatBillNo(await getNextBillSerial(year), year) };
}

// ─── Patients (each doc IS the bill — see model comment) ─────────────────────

const PATIENT_READONLY = [
  "_id", "createdAt", "updatedAt", "__v",
  "billNo", "billYear", "billSerial",
];

// A patient is never created without their bill in the same call — the form
// that posts here always sends both patient fields and bill fields together.
export async function createPatient(data: any) {
  const clean = { ...data };
  for (const k of PATIENT_READONLY) delete clean[k];

  const tests = cleanTests(clean.tests);
  const { totalAmount, discount, discountAmount, billAmount } = computeBillAmounts(tests, clean.discount);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const billYear   = istYear();
      const billSerial = await getNextBillSerial(billYear);
      return await DiagnosticPatient.create({
        ...clean,
        tests, totalAmount, discount, discountAmount, billAmount,
        billNo: formatBillNo(billSerial, billYear),
        billYear, billSerial,
        billDate: clean.billDate ? new Date(clean.billDate) : new Date(),
        paymentMode: clean.paymentMode || "Cash",
      });
    } catch (err: any) {
      // Duplicate key on billNo/billSerial: a concurrent registration just won
      // the race for this serial — re-read the count (which now includes it)
      // and retry.
      if (err.code === 11000 && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error("Failed to register patient after 5 attempts due to concurrent billing");
}

export async function getPatient(id: string) {
  return DiagnosticPatient.findById(id);
}

// Edits both the patient section and the bill section of the same doc in one
// call. Bill amounts are always recomputed from the submitted tests/discount
// (never trusted from the client) so a stored bill always adds up; billNo/
// billYear/billSerial are permanently fixed once issued.
export async function updatePatient(id: string, data: any) {
  const clean = { ...data };
  for (const k of PATIENT_READONLY) delete clean[k];

  if (clean.tests !== undefined || clean.discount !== undefined) {
    const existing = await DiagnosticPatient.findById(id, { tests: 1, discount: 1 });
    if (!existing) return null;
    const tests = cleanTests(clean.tests !== undefined ? clean.tests : existing.tests);
    const discountPct = clean.discount !== undefined ? clean.discount : existing.discount;
    Object.assign(clean, { tests, ...computeBillAmounts(tests, discountPct) });
  }
  if (clean.billDate !== undefined) clean.billDate = new Date(clean.billDate);

  return DiagnosticPatient.findByIdAndUpdate(id, { $set: clean }, { new: true, runValidators: true });
}

export async function deletePatient(id: string) {
  const patient = await DiagnosticPatient.findByIdAndDelete(id);
  if (!patient) throw new Error("Patient not found");
  return patient;
}

// Search by name / phone / bill no, or by a date range matched against either
// registration date or bill date.
export async function searchPatients(query: {
  name?: string; phone?: string; billNo?: string; from?: string; to?: string;
}) {
  const filter: any = {};
  if (query.name)   filter.name   = { $regex: escapeRegex(query.name.trim()), $options: "i" };
  if (query.phone)  filter.phone  = { $regex: escapeRegex(query.phone.trim()) };
  if (query.billNo) filter.billNo = query.billNo.trim();

  if (query.from || query.to) {
    const range: any = {};
    if (query.from) range.$gte = new Date(query.from);
    if (query.to)   range.$lte = new Date(query.to);
    filter.$or = [{ registrationDate: range }, { billDate: range }];
  }

  return DiagnosticPatient.find(filter).sort({ createdAt: -1 }).limit(200).lean();
}

// ─── Dashboard stats ─────────────────────────────────────────────────────────

// UTC bounds of today's IST calendar day — the default range, like OPD's.
function istTodayBounds(): { start: Date; end: Date } {
  const istDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return {
    start: new Date(`${istDate}T00:00:00+05:30`),
    end:   new Date(`${istDate}T23:59:59.999+05:30`),
  };
}

// Bills are counted by billDate (the business date on the bill), for the
// range and for the equal-length period immediately before it.
export async function getDashboardStats(fromQ?: string, toQ?: string) {
  const { start, end } = fromQ && toQ
    ? { start: new Date(fromQ), end: new Date(toQ) }
    : istTodayBounds();
  const prevEnd   = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - (end.getTime() - start.getTime()));

  const inRange   = { billDate: { $gte: start,     $lte: end     } };
  const inPrevious = { billDate: { $gte: prevStart, $lte: prevEnd } };
  const totals = (match: any) => DiagnosticPatient.aggregate([
    { $match: match },
    { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$billAmount" }, discount: { $sum: "$discountAmount" } } },
  ]);

  const [cur, prev, byDepartment, topTests, byPaymentMode, recentBills] = await Promise.all([
    totals(inRange),
    totals(inPrevious),
    // Department / test figures are gross test charges (before bill discount).
    DiagnosticPatient.aggregate([
      { $match: inRange },
      { $unwind: "$tests" },
      { $group: {
        _id: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ["$tests.department", ""] } }, 0] }, "$tests.department", "OTHER"] },
        tests: { $sum: 1 },
        amount: { $sum: "$tests.charge" },
      } },
      { $sort: { amount: -1 } },
    ]),
    DiagnosticPatient.aggregate([
      { $match: inRange },
      { $unwind: "$tests" },
      { $group: { _id: "$tests.testName", department: { $first: "$tests.department" }, count: { $sum: 1 }, amount: { $sum: "$tests.charge" } } },
      { $sort: { count: -1, amount: -1 } },
      { $limit: 10 },
    ]),
    DiagnosticPatient.aggregate([
      { $match: inRange },
      { $group: { _id: "$paymentMode", count: { $sum: 1 }, amount: { $sum: "$billAmount" } } },
      { $sort: { amount: -1 } },
    ]),
    DiagnosticPatient.find(inRange)
      .select("title name billNo billDate tests billAmount paymentMode")
      .sort({ billDate: -1, createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  return {
    patients: { current: cur[0]?.count   ?? 0, previous: prev[0]?.count   ?? 0 },
    revenue:  { current: cur[0]?.revenue ?? 0, previous: prev[0]?.revenue ?? 0 },
    discount: cur[0]?.discount ?? 0,
    byDepartment:  byDepartment.map(d => ({ department: d._id, tests: d.tests, amount: d.amount })),
    topTests:      topTests.map(t => ({ testName: t._id, department: t.department || "", count: t.count, amount: t.amount })),
    byPaymentMode: byPaymentMode.map(m => ({ paymentMode: m._id || "—", count: m.count, amount: m.amount })),
    recentBills,
  };
}

// ─── Test catalogue ──────────────────────────────────────────────────────────

export async function getTests(activeOnly = true) {
  const filter: any = activeOnly ? { isActive: true } : {};
  return DiagnosticTest.find(filter).sort({ sortOrder: 1, testName: 1 }).lean();
}

export async function createTest(data: any) {
  const testName = String(data.testName || "").trim().toUpperCase();
  if (!testName) throw new Error("Test name is required");
  const existing = await DiagnosticTest.findOne({ testName });
  if (existing) throw new Error("A test with this name already exists");
  return DiagnosticTest.create({
    testName,
    department: String(data.department || "").trim().toUpperCase(),
    charge:    Number(data.charge) || 0,
    isActive:  data.isActive !== false,
    sortOrder: Number(data.sortOrder) || 0,
  });
}

export async function updateTest(id: string, data: any) {
  const allowed = ["testName", "department", "charge", "isActive", "sortOrder"];
  const update: any = {};
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key];
  }
  if (update.testName  !== undefined) update.testName  = String(update.testName).trim().toUpperCase();
  if (update.department !== undefined) update.department = String(update.department).trim().toUpperCase();
  if (update.charge    !== undefined) update.charge    = Number(update.charge) || 0;
  if (update.sortOrder !== undefined) update.sortOrder = Number(update.sortOrder) || 0;
  return DiagnosticTest.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
}

export async function deleteTest(id: string) {
  return DiagnosticTest.findByIdAndDelete(id);
}
