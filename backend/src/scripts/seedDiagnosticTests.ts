/**
 * Seed script: populates the DiagnosticTest catalogue (Diagnostics module)
 * from the hospital's rate sheets:
 *   - "USG AND ECHO RATES" (signed 06/07/2026) — USG (Radiology) + Echo (Cardiology)
 *   - "Arogya X-ray rates" (signed 01/08/2025) — X-ray (Radiology). Only the
 *     IPD / "PROPOSED (40% ADD)" column is used; the OPD rate column is
 *     intentionally NOT seeded.
 *
 * Unlike seedServiceCatalogue.ts this UPSERTS by testName: a test that already
 * exists gets its rate / department / sort order reset to the sheet's value,
 * so re-running it after a rate-sheet change applies the new rates. (It also
 * means re-running overwrites any rate edited by hand in Test Catalogue.)
 * Tests in the DB that aren't on the sheet are left untouched.
 *
 * Run: npm run seed:diagnostic-tests   (in backend/)
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import DiagnosticTest from "../models/DiagnosticTest.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hospital";

interface TestEntry { testName: string; department: string; charge: number; }

// ─── USG & Echo (sheet: USG AND ECHO RATES) ───────────────────────────────────
const USG_ECHO: TestEntry[] = [
  { testName: "USG WHOLE ABDOMEN",     department: "RADIOLOGY",  charge: 1500 },
  { testName: "USG LOWER ABDOMEN",     department: "RADIOLOGY",  charge: 900  },
  { testName: "USG UPPER ABDOMEN",     department: "RADIOLOGY",  charge: 900  },
  { testName: "USG KUB",               department: "RADIOLOGY",  charge: 900  },
  { testName: "USG PREGNANCY PROFILE", department: "RADIOLOGY",  charge: 1000 },
  { testName: "USG FOLLICULAR STUDY",  department: "RADIOLOGY",  charge: 1500 },
  { testName: "NT SCAN",               department: "RADIOLOGY",  charge: 2200 },
  { testName: "2D ECHOCARDIOGRAPHY",   department: "CARDIOLOGY", charge: 1400 },
  { testName: "ECHOCARDIOGRAPHY",      department: "CARDIOLOGY", charge: 1400 },
  { testName: "ECHO DOPPLER",          department: "CARDIOLOGY", charge: 2400 },
];

// ─── X-ray (sheet: Arogya X-ray rates — IPD / PROPOSED (40% ADD) column) ──────
// Names are prefixed "X-RAY " so they read unambiguously on a bill (e.g.
// "X-RAY KUB" vs "USG KUB"). Two sheet typos are corrected: "LUMBER SPINE" →
// "LUMBAR SPINE", "LUMBP-SACRAL JOINT" → "LUMBO-SACRAL JOINT".
const XRAY: [string, number][] = [
  ["CHEST PA",              350],
  ["CHEST AP",              350],
  ["CHEST AP/LAT",          700],
  ["CHEST AP/OBL",          700],
  ["CHEST PA/LAT",          700],
  ["CHEST PA/OBL",          700],
  ["HAND PA/OBL",           500],
  ["HAND PA/LAT",           500],
  ["WRIST PA/LAT",          500],
  ["WRIST PA/OBL",          500],
  ["BOTH HAND AP/OBL",      630],
  ["FOREARM AP/LAT",        500],
  ["ELBOW JOINT AP/LAT",    500],
  ["HUMERUS AP/LAT",        500],
  ["SHOULDER JOINT AP/LAT", 500],
  ["CLAVICLE AP/LAT",       500],
  ["CLAVICLE AP/AXIAL",     500],
  ["PELVIS AP",             500],
  ["HIP JOINT AP/LAT",      500],
  ["FEMUR AP/LAT",          500],
  ["KNEE JOINT AP/LAT",     500],
  ["BOTH KNEE JOINT AP/LAT",910],
  ["LEG AP/LAT",            500],
  ["ANKLE JOINT AP/LAT",    500],
  ["FOOT AP/LAT",           500],
  ["FOOT AP/OBL",           500],
  ["S-I JOINT",             500],
  ["CALCANEUM AP/AXIAL",    500],
  ["S-C JOINT",             500],
  ["THORACIC SPINE AP/LAT", 500],
  ["LUMBAR SPINE AP/LAT",   500],
  ["LUMBO-SACRAL JOINT",    500],
  ["PNS",                   500],
  ["SKULL AP",              500],
  ["SKULL AP/LAT",          700],
  ["ABDOMEN AP ERECT",      350],
  ["ABDOMEN AP SUPINE",     350],
  ["ABDOMEN AP/LAT",        700],
  ["CERVICAL SPINE AP/LAT", 500],
  ["KUB",                   500],
];

const TESTS: TestEntry[] = [
  ...USG_ECHO,
  ...XRAY.map(([name, charge]) => ({ testName: `X-RAY ${name}`, department: "RADIOLOGY", charge })),
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB:", MONGO_URI);

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const [i, t] of TESTS.entries()) {
    const sortOrder = i + 1; // sheet order: USG, Echo, then X-ray
    const existing = await DiagnosticTest.findOne({ testName: t.testName });

    if (!existing) {
      await DiagnosticTest.create({ ...t, sortOrder, isActive: true });
      created++;
    } else if (existing.charge !== t.charge || existing.department !== t.department || existing.sortOrder !== sortOrder) {
      console.log(`  update ${t.testName}: ₹${existing.charge} → ₹${t.charge}${existing.department !== t.department ? ` (dept ${existing.department || "—"} → ${t.department})` : ""}`);
      existing.charge     = t.charge;
      existing.department = t.department;
      existing.sortOrder  = sortOrder;
      await existing.save();
      updated++;
    } else {
      unchanged++;
    }
  }

  console.log(`\nDiagnostic test catalogue seeding complete:`);
  console.log(`  Created   : ${created}`);
  console.log(`  Updated   : ${updated}`);
  console.log(`  Unchanged : ${unchanged}`);
  console.log(`  Total     : ${TESTS.length} tests (${USG_ECHO.length} USG/Echo, ${XRAY.length} X-ray)`);

  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB.");
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
