import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const doctors = [
  { name: "DEBARCHAN GHOSH",              username: "debarchan.ghosh",            specialization: "SURGEON" },
  { name: "A. K. KHAITAN",                username: "ak.khaitan",                 specialization: "PSYCHIATRY" },
  { name: "ABHIJIT MONDAL",               username: "abhijit.mondal",             specialization: "" },
  { name: "ACHYUT ROY CHOUDHURI",         username: "achyut.roy.choudhuri",       specialization: "ANESTHETIST" },
  { name: "AMITAVA DAS (SPECIALIST)",     username: "amitava.das.specialist",     specialization: "CARDIOLOGIST" },
  { name: "ANISH HAZRA",                  username: "anish.hazra",                specialization: "" },
  { name: "ANUVAB GOSWAMI",               username: "anuvab.goswami",             specialization: "" },
  { name: "ANWESHA CHAKRABORTY",          username: "anwesha.chakraborty",        specialization: "" },
  { name: "ARCOJIT GHOSH",                username: "arcojit.ghosh",              specialization: "" },
  { name: "ARJUN ROY",                    username: "arjun.roy",                  specialization: "NEPHROLOGIST" },
  { name: "ARPITA SARKAR",                username: "arpita.sarkar",              specialization: "" },
  { name: "AVISHEK JAISWAL",              username: "avishek.jaiswal",            specialization: "" },
  { name: "BARUN PRAMANIK",               username: "barun.pramanik",             specialization: "PHYSIOTHERAPY" },
  { name: "BHASKAR SINHA",                username: "bhaskar.sinha",              specialization: "GENERAL" },
  { name: "CHANDRANEEL SAHA",             username: "chandraneel.saha",           specialization: "ANESTHETIST" },
  { name: "D. J. BHAUMIK",                username: "dj.bhaumik",                 specialization: "MBBS, MS" },
  { name: "DEBANIK SARKAR",               username: "debanik.sarkar",             specialization: "" },
  { name: "DEBARCHAN GHOSH (SPECIALIST)", username: "debarchan.ghosh.specialist", specialization: "SURGEON" },
  { name: "DEEP DAS (SPECIALIST)",        username: "deep.das.specialist",        specialization: "NEUROLOGIST" },
  { name: "DR. ARDHENDU SEKHAR PANDIT",   username: "ardhendu.sekhar.pandit",     specialization: "" },
  { name: "EMERGENCY MANAGEMENT CARE",    username: "emergency.management",       specialization: "" },
  { name: "GOURAB BANERJEE",              username: "gourab.banerjee",            specialization: "" },
  { name: "GOURAV BANERJEE",              username: "gourav.banerjee",            specialization: "" },
  { name: "GOUTAM GHOSH",                 username: "goutam.ghosh",               specialization: "GENERAL" },
  { name: "HIMADRI SEKHAR CHAKRABORTY",   username: "himadri.sekhar.chakraborty", specialization: "ANESTHETIST" },
  { name: "INDRANEEL SAHA",               username: "indraneel.saha",             specialization: "GASTROINTESTINAL" },
  { name: "INITIAL MANAGEMENT CHARGES",   username: "initial.management.charges", specialization: "" },
  { name: "K. C. MALLICK",                username: "kc.mallick",                 specialization: "" },
  { name: "LALTU CHANDA",                 username: "laltu.chanda",               specialization: "PHYSIOTHERAPY" },
  { name: "MALOY KUMAR BERA",             username: "maloy.kumar.bera",           specialization: "" },
  { name: "MANOJ KUMAR ADAK",             username: "manoj.kumar.adak",           specialization: "ANESTHETIST" },
  { name: "MD. BASIR AHAMED",             username: "md.basir.ahamed",            specialization: "" },
  { name: "MONICA SHAH",                  username: "monica.shah",                specialization: "GYNAECOLOGIST" },
  { name: "MUKESH KUMAR VIJAY",           username: "mukesh.kumar.vijay",         specialization: "UROLOGIST & GEN. SURGEON" },
  { name: "NILADRI SEKHAR MUKHERJEE",     username: "niladri.sekhar.mukherjee",   specialization: "ANESTHETIST" },
  { name: "NIRDESH TIWARI",               username: "nirdesh.tiwari",             specialization: "" },
  { name: "P.K.PUJARI",                   username: "pk.pujari",                  specialization: "" },
  { name: "PIYALI CHATTOPADHYAY",         username: "piyali.chattopadhyay",       specialization: "GYNAECOLOGIST" },
  { name: "PRANJAL SARKAR",               username: "pranjal.sarkar",             specialization: "" },
  { name: "PREETI VIJAY",                 username: "preeti.vijay",               specialization: "GYNAECOLOGIST & OBSTERTRICIAN" },
  { name: "PREETY VIJAY",                 username: "preety.vijay",               specialization: "GYNAECOLOGIST" },
  { name: "RAJESH JINDEL",                username: "rajesh.jindel",              specialization: "ONCOLOGY" },
  { name: "RESHMI DUTTA SARKAR",          username: "reshmi.dutta.sarkar",        specialization: "" },
  { name: "RICK BANERJEE",                username: "rick.banerjee",              specialization: "PULMONOLOGIST" },
  { name: "SAIKAT SARKAR",                username: "saikat.sarkar",              specialization: "" },
  { name: "SANDIP BHATTACHRYA",           username: "sandip.bhattachrya",         specialization: "" },
  { name: "SANJAY SEN",                   username: "sanjay.sen",                 specialization: "ORTHOPAEDIC SURGEON" },
  { name: "SANKHADIP PRAMANIK",           username: "sankhadip.pramanik",         specialization: "" },
  { name: "SASHI JINDEL",                 username: "sashi.jindel",               specialization: "GYNAECOLOGIST" },
  { name: "SIDHARTH DAS",                 username: "sidharth.das",               specialization: "" },
  { name: "SK.M. A.UDDIN",                username: "skm.auddin",                 specialization: "" },
  { name: "SOUGATA BHATTACHARYA",         username: "sougata.bhattacharya",       specialization: "" },
  { name: "SOUMYA DAS",                   username: "soumya.das",                 specialization: "PULMONOLOGIST" },
  { name: "SOUMYA GAYEN",                 username: "soumya.gayen",               specialization: "" },
  { name: "SOUMYADIP GUPTA",              username: "soumyadip.gupta",            specialization: "ANESTHETIST" },
  { name: "SOURAV BASU",                  username: "sourav.basu",                specialization: "ANESTHETIST" },
  { name: "SREEMANTI BAG",                username: "sreemanti.bag",              specialization: "" },
  { name: "SUBHADIP PAL",                 username: "subhadip.pal",               specialization: "" },
  { name: "SUBIR PAUL",                   username: "subir.paul",                 specialization: "PAEDIATRIC SURGEON" },
  { name: "SUMIT GOSWAMI",                username: "sumit.goswami",              specialization: "ANESTHETIST" },
  { name: "SUPARNA DAS",                  username: "suparna.das",                specialization: "SPEACH THERAPIST" },
  { name: "TAPAS LAHA",                   username: "tapas.laha",                 specialization: "" },
  { name: "VIDAGDHAMAY BISWAS",           username: "vidagdhamay.biswas",         specialization: "ANESTHETIST" },
  { name: "VIPIN KATIYAR",                username: "vipin.katiyar",              specialization: "UROLOGIST & GEN. SURGEON" },
];

const seedDoctors = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hospital_db");
    console.log("Connected to MongoDB");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("doctor123", salt);

    // Find the highest existing mobile among Doctor users so we don't collide
    const lastDoc = await User.findOne({ role: "Doctor" }).sort({ mobile: -1 }).lean() as any;
    let mobileCounter = lastDoc ? (parseInt(lastDoc.mobile, 10) || 9000000000) : 9000000000;

    let created = 0;
    let skipped = 0;

    for (const doc of doctors) {
      const existingByUsername = await User.findOne({ username: doc.username });
      if (existingByUsername) {
        console.log(`  Skipped (username exists): ${doc.username}`);
        skipped++;
        continue;
      }

      mobileCounter++;
      // Ensure the generated mobile isn't already taken
      while (await User.exists({ mobile: String(mobileCounter) })) {
        mobileCounter++;
      }
      const mobile = String(mobileCounter);

      await User.create({
        name:            doc.name,
        username:        doc.username,
        password:        hashedPassword,
        mobile,
        role:            "Doctor",
        department:      "OPD",
        specialization:  doc.specialization,
        consultancyFees: "",
      });

      console.log(`  Created: ${doc.name}${doc.specialization ? ` (${doc.specialization})` : ""} — mobile: ${mobile}`);
      created++;
    }

    console.log(`\nDone — ${created} created, ${skipped} skipped.`);
    console.log("Default login password for all: doctor123");
  } catch (error) {
    console.error("Error seeding doctors:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedDoctors();
