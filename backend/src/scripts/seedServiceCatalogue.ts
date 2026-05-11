/**
 * Seed script: populates ServiceCatalogue collection with all services
 * from the hospital's billing system (per the ITEMWISE BILL TO ENTER spec).
 *
 * Run: npx ts-node -e "require('./src/scripts/seedServiceCatalogue')"
 *   or add an npm script: "seed:services": "ts-node src/scripts/seedServiceCatalogue.ts"
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import ServiceCatalogue from "../models/ServiceCatalogue.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hospital";

interface ServiceEntry {
  serviceGroup: string;
  serviceGroupCode: string;
  serviceName: string;
  unit: string;
  defaultCharge: number;
  requiresDoctor?: boolean;
  isReferral?: boolean;
  sortOrder: number;
}

// ─── Complete service catalogue ───────────────────────────────────────────────

const SERVICES: ServiceEntry[] = [
  // ── RGST CHARGES (code 24) ─────────────────────────────────────────────────
  { serviceGroup: "RGST CHARGES",    serviceGroupCode: "24",  serviceName: "REGISTRATION CHARGES",                  unit: "PER CASE",       defaultCharge: 200,  sortOrder: 1 },

  // ── WARD (code 004) ────────────────────────────────────────────────────────
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "AIR MATRESS",                           unit: "PER DAY",        defaultCharge: 300,  sortOrder: 1 },
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "ATTENDANT",                             unit: "PER DAY",        defaultCharge: 450,  sortOrder: 2 },
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "ATTENDANT(SPL)",                        unit: "PER DAY",        defaultCharge: 500,  sortOrder: 3 },
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "BABY COT",                              unit: "PER CASE",       defaultCharge: 0,    sortOrder: 4 },
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "BI-PAP",                                unit: "PER DAY",        defaultCharge: 0,    sortOrder: 5 },
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "ECG",                                   unit: "PER USE",        defaultCharge: 350,  sortOrder: 6 },
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "GLUCOMETER",                            unit: "PER USE",        defaultCharge: 100,  sortOrder: 7 },
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "NEBULIZER",                             unit: "PER USE",        defaultCharge: 150,  sortOrder: 8 },
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "OXYGEN",                                unit: "HOUR",           defaultCharge: 100,  sortOrder: 9 },
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "PULSE OXYMETER",                       unit: "PER DAY",        defaultCharge: 100,  sortOrder: 10 },
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "SUCTION MACHINE",                      unit: "PER USE",        defaultCharge: 200,  sortOrder: 11 },
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "SYRINGE PUMP",                         unit: "PER DAY",        defaultCharge: 350,  sortOrder: 12 },
  { serviceGroup: "WARD",            serviceGroupCode: "004", serviceName: "VENTILATOR",                            unit: "PER DAY",        defaultCharge: 2000, sortOrder: 13 },

  // ── CONSULTATION (code 10) ─────────────────────────────────────────────────
  { serviceGroup: "CONSULTATION",    serviceGroupCode: "10",  serviceName: "CONSULTATION",                          unit: "VISIT",          defaultCharge: 0,    sortOrder: 1,  requiresDoctor: true },
  { serviceGroup: "CONSULTATION",    serviceGroupCode: "10",  serviceName: "REFERRAL DOCTOR",                       unit: "VISIT",          defaultCharge: 0,    sortOrder: 2,  requiresDoctor: true, isReferral: true },
  { serviceGroup: "CONSULTATION",    serviceGroupCode: "10",  serviceName: "INITIAL MANAGEMENT CHARGES",            unit: "PER CASE",       defaultCharge: 2000, sortOrder: 3 },

  // ── BLOOD (code 29) ────────────────────────────────────────────────────────
  { serviceGroup: "BLOOD",           serviceGroupCode: "29",  serviceName: "ASHOK BLOOD BANK",                      unit: "PER UNIT",       defaultCharge: 0,    sortOrder: 1 },
  { serviceGroup: "BLOOD",           serviceGroupCode: "29",  serviceName: "COLLECTION CHARGES",                    unit: "PER CASE",       defaultCharge: 200,  sortOrder: 2 },
  { serviceGroup: "BLOOD",           serviceGroupCode: "29",  serviceName: "KOTHARI BLOOD BANK",                    unit: "PER UNIT",       defaultCharge: 0,    sortOrder: 3 },

  // ── OT CHARGES (code 003) ──────────────────────────────────────────────────
  { serviceGroup: "OT CHARGES",      serviceGroupCode: "003", serviceName: "BABY COT",                              unit: "PER DAY",        defaultCharge: 0,    sortOrder: 1 },
  { serviceGroup: "OT CHARGES",      serviceGroupCode: "003", serviceName: "C-ARM",                                 unit: "PER CASE",       defaultCharge: 1500, sortOrder: 2 },
  { serviceGroup: "OT CHARGES",      serviceGroupCode: "003", serviceName: "LAP INSTRUMENT CHARGES",                unit: "PER CASE",       defaultCharge: 2500, sortOrder: 3 },
  { serviceGroup: "OT CHARGES",      serviceGroupCode: "003", serviceName: "LASER CHARGES",                         unit: "PER CASE",       defaultCharge: 0,    sortOrder: 4 },
  { serviceGroup: "OT CHARGES",      serviceGroupCode: "003", serviceName: "NEXT OPERATION THEATRE FIRST HOUR",     unit: "HOUR",           defaultCharge: 3000, sortOrder: 5 },
  { serviceGroup: "OT CHARGES",      serviceGroupCode: "003", serviceName: "OPERATION THEATRE FIRST HOUR",          unit: "HOUR",           defaultCharge: 5500, sortOrder: 6 },
  { serviceGroup: "OT CHARGES",      serviceGroupCode: "003", serviceName: "OPERATION THEATRE HALF AN HOUR",        unit: "HOUR",           defaultCharge: 1500, sortOrder: 7 },
  { serviceGroup: "OT CHARGES",      serviceGroupCode: "003", serviceName: "OPERATION THEATRE L.A",                 unit: "PER CASE",       defaultCharge: 1500, sortOrder: 8 },
  { serviceGroup: "OT CHARGES",      serviceGroupCode: "003", serviceName: "OPERATION THEATRE S.A/GA",              unit: "PER CASE",       defaultCharge: 3500, sortOrder: 9 },

  // ── PHYSIOTHERAPY (code 30) ────────────────────────────────────────────────
  { serviceGroup: "PHYSIOTHERAPY",   serviceGroupCode: "30",  serviceName: "PHYSIOTHERAPIST",                       unit: "PER DAY",        defaultCharge: 300,  sortOrder: 1,  requiresDoctor: true },

  // ── PROCEDURE (code 11) ────────────────────────────────────────────────────
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "ARTERIAL LINE",                         unit: "PER CASE",       defaultCharge: 0,    sortOrder: 1 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "ASPIRATION & INTRA ARTICULAR INJECTION",unit: "",               defaultCharge: 0,    sortOrder: 2 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "BILIARY STENTING BY ERCP",              unit: "",               defaultCharge: 0,    sortOrder: 3 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "BLOOD TRANSFUSION CHARGES",             unit: "PER TRANSFUSION",defaultCharge: 0,    sortOrder: 4 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "BONE MARROW ASPIRATION",                unit: "PER CASE",       defaultCharge: 0,    sortOrder: 5 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "BRONCHOSCOPY",                          unit: "",               defaultCharge: 0,    sortOrder: 6 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "CATHERIZATION CHARGES",                 unit: "PER CASE",       defaultCharge: 700,  sortOrder: 7 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "CATHETER REMOVAL DONE",                 unit: "PER CASE",       defaultCharge: 0,    sortOrder: 8 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "CENTRAL LINE",                          unit: "PER CASE",       defaultCharge: 3000, sortOrder: 9 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "CHEMOTHERAPY",                          unit: "PER CASE",       defaultCharge: 0,    sortOrder: 10 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "COLONOSCOPY",                           unit: "",               defaultCharge: 0,    sortOrder: 11 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "CRE BALLOON DILATATION",                unit: "",               defaultCharge: 0,    sortOrder: 12 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "CSF STUDY",                             unit: "",               defaultCharge: 0,    sortOrder: 13 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "CYSTOCELE",                             unit: "",               defaultCharge: 0,    sortOrder: 14 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "DRESSING CHARGE",                       unit: "PER DAY",        defaultCharge: 0,    sortOrder: 15 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "DRESSING CHARGE LARGE",                 unit: "PER DAY",        defaultCharge: 1000, sortOrder: 16 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "DRESSING CHARGE SMALL",                 unit: "PER DAY",        defaultCharge: 500,  sortOrder: 17 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "DVT STOCKINGS PUMP",                    unit: "PER DAY",        defaultCharge: 0,    sortOrder: 18 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "ENDOSCOPIC ULTRASOUND (EUS)",            unit: "",               defaultCharge: 0,    sortOrder: 19 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "ENDOSCOPIC ULTRASOUND (THERAPEUTIC)",   unit: "",               defaultCharge: 0,    sortOrder: 20 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "ENDOSCOPIC VARICEAL LIGATION (EVL)",    unit: "",               defaultCharge: 0,    sortOrder: 21 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "ENDOSCOPIC VARICEAL LIGATION WITH ANAESTHESIA (EVL)", unit: "", defaultCharge: 0,    sortOrder: 22 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "ENDOSCOPY",                             unit: "",               defaultCharge: 0,    sortOrder: 23 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "ENDOSCOPY COLONOSCOPY WITH ANAESTHESIA",unit: "",               defaultCharge: 0,    sortOrder: 24 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "ERCP",                                  unit: "",               defaultCharge: 0,    sortOrder: 25 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "ERCP SIDE VIEW",                        unit: "",               defaultCharge: 0,    sortOrder: 26 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "ERCP STENT REMOVE",                     unit: "",               defaultCharge: 0,    sortOrder: 27 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "ERCP WITH STENT",                       unit: "",               defaultCharge: 0,    sortOrder: 28 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "EVL",                                   unit: "",               defaultCharge: 0,    sortOrder: 29 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "FIBEROPTIC INTUBATION AT OT",           unit: "USE",            defaultCharge: 0,    sortOrder: 30 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "FIBROSCAN",                             unit: "",               defaultCharge: 0,    sortOrder: 31 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "FIBROSCAN OF LIVER",                    unit: "",               defaultCharge: 0,    sortOrder: 32 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "FNAC",                                  unit: "",               defaultCharge: 0,    sortOrder: 33 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "INTUBATION CHARGES",                    unit: "PER CASE",       defaultCharge: 3000, sortOrder: 34 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "JUGLAR LINE CHARGES",                   unit: "PER CASE",       defaultCharge: 0,    sortOrder: 35 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "LARYNGOSCOPIE R-TUBE DONE",             unit: "USE",            defaultCharge: 0,    sortOrder: 36 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "NASAL PACK",                            unit: "",               defaultCharge: 0,    sortOrder: 37 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "NCV 4 LIMB",                            unit: "",               defaultCharge: 0,    sortOrder: 38 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "PACE MAKER (PPM)",                      unit: "",               defaultCharge: 0,    sortOrder: 39 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "PACE MAKER RENT (GENERATOR)",           unit: "PER DAY",        defaultCharge: 0,    sortOrder: 40 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "PACE MATER PROGRAMMING",                unit: "",               defaultCharge: 0,    sortOrder: 41 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "POLYPECTOMY",                           unit: "",               defaultCharge: 0,    sortOrder: 42 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "RYLE TUBE FEEDING",                     unit: "PER CASE",       defaultCharge: 500,  sortOrder: 43 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "SIDE VIEW ENDOSCOPY",                   unit: "",               defaultCharge: 0,    sortOrder: 44 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "SIGMOIDOSCOPY",                         unit: "",               defaultCharge: 0,    sortOrder: 45 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "STICHING",                              unit: "PER STICH",      defaultCharge: 0,    sortOrder: 46 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "TAPING CHARGES",                        unit: "PER CASE",       defaultCharge: 0,    sortOrder: 47 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "TEMPORARY PACE MAKING (BED SIDE)",      unit: "PER CASE",       defaultCharge: 0,    sortOrder: 48 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "TRACHEOSTOMY",                          unit: "",               defaultCharge: 0,    sortOrder: 49 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "TRACHEOSTOMY TUBE REMOVED",             unit: "PER CASE",       defaultCharge: 0,    sortOrder: 50 },
  { serviceGroup: "PROCEDURE",       serviceGroupCode: "11",  serviceName: "VEP",                                   unit: "",               defaultCharge: 0,    sortOrder: 51 },

  // ── SURGEON FEES (code 23) ─────────────────────────────────────────────────
  { serviceGroup: "SURGEON FEES",    serviceGroupCode: "23",  serviceName: "SURGEON FEES",                          unit: "PER CASE",       defaultCharge: 0,    sortOrder: 1,  requiresDoctor: true },

  // ── OTHERS CHARGES (code 28) ───────────────────────────────────────────────
  { serviceGroup: "OTHERS CHARGES",  serviceGroupCode: "28",  serviceName: "AMBULANCE (AC)",                        unit: "PER CASE",       defaultCharge: 700,  sortOrder: 1 },
  { serviceGroup: "OTHERS CHARGES",  serviceGroupCode: "28",  serviceName: "MODERN CARE (COST OF IMPLANT)",         unit: "PER CASE",       defaultCharge: 0,    sortOrder: 2 },
  { serviceGroup: "OTHERS CHARGES",  serviceGroupCode: "28",  serviceName: "OVER AND EXCESS",                       unit: "",               defaultCharge: 0,    sortOrder: 3 },
  { serviceGroup: "OTHERS CHARGES",  serviceGroupCode: "28",  serviceName: "SURGICAL EXPRESS (COST OF IMPLANT)",    unit: "PER USE",        defaultCharge: 0,    sortOrder: 4 },

  // ── HEMODIALYSIS (code 12) ─────────────────────────────────────────────────
  { serviceGroup: "HEMODIALYSIS",    serviceGroupCode: "12",  serviceName: "1ST DIALYSIS",                          unit: "UNIT",           defaultCharge: 0,    sortOrder: 1 },
  { serviceGroup: "HEMODIALYSIS",    serviceGroupCode: "12",  serviceName: "DIALYSER COST",                         unit: "UNIT",           defaultCharge: 0,    sortOrder: 2 },
  { serviceGroup: "HEMODIALYSIS",    serviceGroupCode: "12",  serviceName: "DIALYSIS",                              unit: "PER DAY",        defaultCharge: 0,    sortOrder: 3 },
  { serviceGroup: "HEMODIALYSIS",    serviceGroupCode: "12",  serviceName: "DIALYSIS CHARGE + DIALYSIS CATHETER, DIALYSIS TUBING", unit: "PER DAY", defaultCharge: 0, sortOrder: 4 },
  { serviceGroup: "HEMODIALYSIS",    serviceGroupCode: "12",  serviceName: "DIALYSIS CHARGES IN DEPT",              unit: "PER SITTING",    defaultCharge: 0,    sortOrder: 5 },
  { serviceGroup: "HEMODIALYSIS",    serviceGroupCode: "12",  serviceName: "DIALYSIS CHARGES IN ICU",               unit: "PER SITTING",    defaultCharge: 0,    sortOrder: 6 },
  { serviceGroup: "HEMODIALYSIS",    serviceGroupCode: "12",  serviceName: "DIALYZER WITH CATHETER CHARGES",        unit: "",               defaultCharge: 0,    sortOrder: 7 },
  { serviceGroup: "HEMODIALYSIS",    serviceGroupCode: "12",  serviceName: "HAEMODIALYSIS",                         unit: "SITTING",        defaultCharge: 0,    sortOrder: 8 },
  { serviceGroup: "HEMODIALYSIS",    serviceGroupCode: "12",  serviceName: "HEMODIALYSIS CHARGES",                  unit: "",               defaultCharge: 0,    sortOrder: 9 },
  { serviceGroup: "HEMODIALYSIS",    serviceGroupCode: "12",  serviceName: "HIGH FLUX DIALYSIS IN ICU WITH ULTRAPURE WATER AND NEW REUSE HF DIALYSER", unit: "PER SITTING", defaultCharge: 0, sortOrder: 10 },
  { serviceGroup: "HEMODIALYSIS",    serviceGroupCode: "12",  serviceName: "NEXT DIALYSIS",                         unit: "UNIT",           defaultCharge: 0,    sortOrder: 11 },
  { serviceGroup: "HEMODIALYSIS",    serviceGroupCode: "12",  serviceName: "SLED DIALYSIS",                         unit: "",               defaultCharge: 0,    sortOrder: 12 },

  // ── ATTENDANT (code 21) ────────────────────────────────────────────────────
  // (custom entries only — no predefined services)

  // ── ATTENDANT SPL (code 22) ────────────────────────────────────────────────
  // (custom entries only)

  // ── CHEMOTHERAPY (code 31) ────────────────────────────────────────────────
  // (custom entries only)

  // ── PHARMACY (code 007) ────────────────────────────────────────────────────
  // (custom entries only)

  // ── GENERAL (code 001) ────────────────────────────────────────────────────
  // (custom entries only)
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB:", MONGO_URI);

  let created = 0;
  let skipped = 0;

  for (const svc of SERVICES) {
    const existing = await ServiceCatalogue.findOne({
      serviceGroup: svc.serviceGroup,
      serviceName:  svc.serviceName,
    });

    if (existing) {
      skipped++;
      continue;
    }

    await ServiceCatalogue.create({
      serviceGroup:     svc.serviceGroup,
      serviceGroupCode: svc.serviceGroupCode,
      serviceName:      svc.serviceName,
      unit:             svc.unit,
      defaultCharge:    svc.defaultCharge,
      requiresDoctor:   svc.requiresDoctor || false,
      isReferral:       svc.isReferral     || false,
      isActive:         true,
      sortOrder:        svc.sortOrder,
    });
    created++;
  }

  console.log(`\nService Catalogue seeding complete:`);
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped} (already exist)`);
  console.log(`  Total   : ${SERVICES.length} services across all groups`);

  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB.");
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
