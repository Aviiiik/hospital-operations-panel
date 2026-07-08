import mongoose from "mongoose";
import dotenv from "dotenv";
import InsuranceCompany from "../models/InsuranceCompany.js";
import Tpa from "../models/Tpa.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hospital";

const INSURANCE_COMPANIES = [
  "ICICI LOMBARD GENERAL INSURANCE", "FUTURE GENERALI INSURANCE", "BAJAJ ALIANZ GENERAL INSURANCE",
  "IFFCO-TOKIO GENERAL INSURANCE", "HDFC ERGO GENERAL INSURANCE", "CIGNA MANIPAL GENERAL INSURANCE",
  "UNIVERSAL SAMPO GENERAL INSURANCE", "ROYAL SUNDARAM GENERAL INSURANCE", "TATA AIG GENERAL INSURANCE",
  "RELIANCE GENERAL INSURANCE", "CHOLA MANDALAM GENERAL INSURANCE", "MAGMA HDI GENERAL INSURANCE",
  "ACKO GENERAL INSURANCE", "NAVI GENERAL INSURANCE CO.", "GO DIGIT GENERAL INSURANCE CO.",
  "NATIONAL INSURANCE CO. LTD", "NEW INDIA ASSURANCE CO. LTD", "UNITED INDIA INSURANCE CO. LTD",
  "ORIENTAL INSURANCE CO. LTD",
];

const TPAS = [
  "HERITAGE HEALTH INSURANCE TPA", "GENINS INSURANCE TPA", "MED-SAVE INSURANCE TPA",
  "PARAMOUNT INSURANCE TPA", "MD-INDIA INSURANCE TPA", "MEDI - ASSIS INSURANCE TPA",
  "RAKSHA INSURANCE TPA", "FAMILY HEALTH INSURANCE TPA", "HEALTH INDIA INSURANCE TPA",
  "PAREKH INSURANCE TPA", "VIDAL INSURANCE TPA", "SAFEWAY INSURANCE TPA",
  "HEALTH INSURANCE TPA", "ALANKIT INSURANCE TPA", "GOOD HEALTH INSURANCE TPA",
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  let inserted = 0;
  let skipped  = 0;

  console.log("\nInsurance Companies:");
  for (const name of INSURANCE_COMPANIES) {
    const existing = await InsuranceCompany.findOne({ name });
    if (existing) { skipped++; continue; }
    await InsuranceCompany.create({ name, isActive: true });
    console.log(`  ✓ ${name}`);
    inserted++;
  }

  console.log("\nTPAs:");
  for (const name of TPAS) {
    const existing = await Tpa.findOne({ name });
    if (existing) { skipped++; continue; }
    await Tpa.create({ name, isActive: true });
    console.log(`  ✓ ${name}`);
    inserted++;
  }

  console.log(`\nDone. Inserted: ${inserted}  Skipped (already exist): ${skipped}`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
