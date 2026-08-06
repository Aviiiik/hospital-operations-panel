import mongoose from "mongoose";
import dotenv from "dotenv";
import ServiceCatalogue from "../models/ServiceCatalogue.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hospital";

// Services that must prompt for + save a doctor name (and therefore show up
// in the IPD Billing "Doctor / Consultation Services" box) but were seeded
// before this was required. seedServiceCatalogue.ts skips already-existing
// items, so this one-off migration flips the flag on live data.
const SERVICES_REQUIRING_DOCTOR = ["INITIAL MANAGEMENT CHARGES"];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const result = await ServiceCatalogue.updateMany(
    { serviceName: { $in: SERVICES_REQUIRING_DOCTOR }, requiresDoctor: { $ne: true } },
    { $set: { requiresDoctor: true } }
  );
  console.log(`Service catalogue items updated: ${result.modifiedCount} (matched: ${result.matchedCount})`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
