import mongoose from "mongoose";
import dotenv from "dotenv";
import InvestigationVendor from "../models/InvestigationVendor.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hospital";

const VENDORS = [
  { code: "AROGYA", name: "AROGYA" },
  { code: "2",      name: "AROGYA DIOGNOSTIC" },
  { code: "9",      name: "DRS. TRIBEDI & ROY" },
  { code: "11",     name: "KOLKATA DIAGNOSTIC" },
  { code: "8",      name: "KOTHARI BLOOD BANK" },
  { code: "1",      name: "MAHENDRA PHARMA" },
  { code: "10",     name: "MEDINOVA DIAGNOSTIC" },
  { code: "4",      name: "MEDVUE" },
  { code: "7",      name: "PULSE" },
  { code: "6",      name: "QUADRA" },
  { code: "3",      name: "RSV" },
  { code: "12",     name: "VIJAYA DIAGNOSTIC" },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  let inserted = 0;
  let skipped  = 0;

  for (const v of VENDORS) {
    const existing = await InvestigationVendor.findOne({ code: v.code });
    if (existing) {
      skipped++;
      continue;
    }
    await InvestigationVendor.create({ ...v, isActive: true });
    console.log(`  ✓ ${v.code.padEnd(8)} ${v.name}`);
    inserted++;
  }

  console.log(`\nDone. Inserted: ${inserted}  Skipped (already exist): ${skipped}`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
