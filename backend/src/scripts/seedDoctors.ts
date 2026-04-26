import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const doctors = [
  { name: "Dr. Debarchan Ghosh",        username: "debarchan.ghosh",       fees: "1000" },
  { name: "Dr. Bhaskar Sinha",           username: "bhaskar.sinha",         fees: "500"  },
  { name: "Dr. Piyali Chatterjee",       username: "piyali.chatterjee",     fees: "700"  },
  { name: "Dr. Anish Hazra",             username: "anish.hazra",           fees: "500"  },
  { name: "Dr. Nirdesh Tiwari",          username: "nirdesh.tiwari",        fees: "700"  },
  { name: "Dr. Kaushik Konar",           username: "kaushik.konar",         fees: "500"  },
  { name: "Dr. Avishek Jaiswal",         username: "avishek.jaiswal",       fees: "500"  },
  { name: "Dr. Soumya Gayen",            username: "soumya.gayen",          fees: "1000" },
  { name: "Dr. Anubhab Goswami",         username: "anubhab.goswami",       fees: "1000" },
  { name: "Dr. Sreemanti Bag",           username: "sreemanti.bag",         fees: "500"  },
  { name: "Dr. Rajesh Jindal",           username: "rajesh.jindal",         fees: "2500" },
  { name: "Dr. Saikat Bhawal",           username: "saikat.bhawal",         fees: "500"  },
  { name: "Dr. Anita Chakraborty Sarkar",username: "anita.chakraborty",     fees: "1000" },
  { name: "Dr. Sk. M. A. Uddin",         username: "sk.ma.uddin",           fees: "600"  },
  { name: "Dr. Siddheartha Das",         username: "siddheartha.das",       fees: "1000" },
  { name: "Dr. Amitava Das",             username: "amitava.das",           fees: "1000" },
  { name: "Dr. Abhijit Mondal",          username: "abhijit.mondal",        fees: "850"  },
  { name: "Dr. Subhadip Pal",            username: "subhadip.pal",          fees: "1000" },
  { name: "Dr. P. K. Pujari",            username: "pk.pujari",             fees: "1500" },
  { name: "Dr. M. K. Vijay",             username: "mk.vijay",              fees: "1200" },
  { name: "Dr. Debanik Sarkar",          username: "debanik.sarkar",        fees: "1000" },
  { name: "Dr. D. J. Bhoumick",          username: "dj.bhoumick",           fees: "1500" },
];

const seedDoctors = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hospital_db");
    console.log("Connected to MongoDB");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("doctor123", salt);

    let created = 0;
    let skipped = 0;

    for (let i = 0; i < doctors.length; i++) {
      const doc = doctors[i];
      const mobile = `90000${String(i + 1).padStart(5, "0")}`;

      const existing = await User.findOne({ username: doc.username });
      if (existing) {
        console.log(`  Skipped (already exists): ${doc.username}`);
        skipped++;
        continue;
      }

      await User.create({
        name: doc.name,
        username: doc.username,
        password: hashedPassword,
        mobile,
        role: "Doctor",
        department: "OPD",
        consultancyFees: doc.fees,
      });

      console.log(`  Created: ${doc.name} (fees: ${doc.fees}, mobile: ${mobile})`);
      created++;
    }

    console.log(`\nDone — ${created} created, ${skipped} skipped.`);
    console.log("Login password for all: doctor123");
  } catch (error) {
    console.error("Error seeding doctors:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedDoctors();
