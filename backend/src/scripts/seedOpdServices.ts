/**
 * Seed script: populates the OpdService collection with the OPD service
 * catalogue that used to be hardcoded in the frontend (opdService.ts).
 *
 * Run: npm run seed:opd-services
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import OpdService from "../models/OpdService.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hospital";

const OPD_SERVICES = [
  { serviceName: "P. ENEMA", charge: 400 },
  { serviceName: "FINGERING ENEMA", charge: 900 },
  { serviceName: "IV INJECTION (FOR 30 MIN)", charge: 300 },
  { serviceName: "INJECTION SHORT", charge: 200 },
  { serviceName: "IM INJECTION", charge: 100 },
  { serviceName: "FOLYS CATHETER", charge: 800 },
  { serviceName: "RYLES'S TUBE", charge: 1000 },
  { serviceName: "DRESSING BIG", charge: 500 },
  { serviceName: "DRESSING SMALL", charge: 300 },
  { serviceName: "IV CHANNEL", charge: 400 },
  { serviceName: "ECG", charge: 350 },
  { serviceName: "STICH REMOVAL", charge: 100 },
  { serviceName: "INSULIN / SUBCUT INJ", charge: 100 },
  { serviceName: "CATHETER WASH / BLADDER WASH", charge: 400 },
  { serviceName: "SUCTION", charge: 300 },
  { serviceName: "Glucometer", charge: 100 },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB:", MONGO_URI);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < OPD_SERVICES.length; i++) {
    const svc = OPD_SERVICES[i];
    const serviceName = svc.serviceName.trim().toUpperCase();

    const existing = await OpdService.findOne({ serviceName });
    if (existing) {
      skipped++;
      continue;
    }

    await OpdService.create({
      serviceName,
      charge:    svc.charge,
      isActive:  true,
      sortOrder: i + 1,
    });
    created++;
  }

  console.log(`\nOPD Service seeding complete:`);
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped} (already exist)`);
  console.log(`  Total   : ${OPD_SERVICES.length} services`);

  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB.");
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
