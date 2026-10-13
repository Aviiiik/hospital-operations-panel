import mongoose from "mongoose";
import dotenv from "dotenv";
import IpdPatient from "../models/IpdPatient.js";
import { reverseDischarge } from "../services/ipdService.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hospital";

// Reverse an IPD discharge from the command line (same logic as the
// "Reverse Discharge" button / POST /api/ipd/patients/:id/reverse-discharge).
// Usage: npm run reverse:discharge -- <admissionId | patient name>
// A name must match exactly one discharged patient (case-insensitive).
async function run() {
  const arg = process.argv.slice(2).join(" ").trim();
  if (!arg) throw new Error("Usage: npm run reverse:discharge -- <admissionId | patient name>");

  await mongoose.connect(MONGO_URI);

  const escaped = arg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
  const matches = await IpdPatient.find({
    status: "Discharged",
    $or: [{ admissionId: arg }, { name: { $regex: `^\\s*${escaped}\\s*$`, $options: "i" } }],
  }).select("name admissionId bedCategory bedNo dischargeDate").lean() as any[];

  if (matches.length === 0) throw new Error(`No discharged IPD patient found for "${arg}"`);
  if (matches.length > 1) {
    console.log("Multiple matches — re-run with the admission ID:");
    matches.forEach(m => console.log(`  ${m.admissionId}  ${m.name}  discharged ${m.dischargeDate?.toISOString().slice(0, 10)}`));
    throw new Error("Ambiguous patient");
  }

  const p = matches[0];
  const updated = await reverseDischarge(String(p._id)) as any;
  console.log(`Reversed discharge: ${updated.name} (${updated.admissionId}) → ${updated.status}, bed ${updated.bedCategory || "—"} ${updated.bedNo || ""}`);

  await mongoose.disconnect();
}

run().catch(async err => {
  console.error(err.message || err);
  await mongoose.disconnect();
  process.exit(1);
});
