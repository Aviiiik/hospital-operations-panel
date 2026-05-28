import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";
import PharmacyMedicine from "../models/PharmacyMedicine.js";
 
dotenv.config();
 
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
 
/**
 * Reads the stock PDF directly and extracts unique medicines.
 *
 * Each data row in the PDF has the format:
 *   MEDICINE NAME(ITEM_CODE)   <HSN 6+ digits>   0   0   <stock>.00
 *
 * We deduplicate by itemCode so each medicine appears only once.
 */
async function extractMedicinesFromPdf(pdfPath: string): Promise<Array<{ itemCode: string; termName: string }>> {
  const rowPattern = /^(.+?)\(([A-Za-z0-9_.* -]+)\)\s+\d{6,}\s+\d+\s+\d+\s+[\d.]+$/;
 
  const buffer = fs.readFileSync(pdfPath);
  const data   = await new PDFParse({ data: buffer }).getText();
 
  const seen = new Map<string, string>(); // itemCode -> termName
 
  for (const raw of data.text.split("\n")) {
    const line = raw.trim();
    const m    = rowPattern.exec(line);
    if (!m) continue;
 
    const termName = m[1].trim().replace(/\*$/, "").trim();
    const itemCode = m[2].trim();
 
    if (itemCode && termName && termName.length > 2) {
      seen.set(itemCode, termName);
    }
  }
 
  return Array.from(seen.entries()).map(([itemCode, termName]) => ({ itemCode, termName }));
}
 
const seedPharmacyMedicines = async () => {
  // Resolve PDF path — place the PDF next to this script,
  // or set STOCK_PDF_PATH in your .env
  const pdfPath =
    process.env.STOCK_PDF_PATH ??
    path.resolve(__dirname, "Stock_Detail__Detail__.pdf");
 
  if (!fs.existsSync(pdfPath)) {
    console.error(`\nPDF not found at: ${pdfPath}`);
    console.error("Place Stock_Detail__Detail__.pdf next to this script, or set STOCK_PDF_PATH in .env");
    process.exit(1);
  }
 
  try {
    await mongoose.connect(process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/hospital_db");
    console.log("Connected to MongoDB");
 
    console.log("Reading PDF…");
    const medicines = await extractMedicinesFromPdf(pdfPath);
    console.log(`Medicines parsed from PDF: ${medicines.length}`);
 
    let created = 0;
    let skipped = 0;
 
    for (const med of medicines) {
      const exists = await PharmacyMedicine.exists({ itemCode: med.itemCode });
      if (exists) {
        console.log(`  Skipped (itemCode exists): ${med.itemCode}`);
        skipped++;
        continue;
      }
 
      await PharmacyMedicine.create({
        itemCode:     med.itemCode,
        termName:     med.termName,
        unitName:     "",
        packingPower: "",
        boxNo:        "",
        mrp:          0,
        isActive:     true,
      });
 
      console.log(`  Created: ${med.termName} (${med.itemCode})`);
      created++;
    }
 
    console.log(`\nDone — ${created} created, ${skipped} skipped.`);
  } catch (error) {
    console.error("Error seeding pharmacy medicines:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};
 
seedPharmacyMedicines();