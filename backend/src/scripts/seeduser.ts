// backend/src/scripts/seedUsers.ts
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const dummyUsers = [
  {
    name: "Dr. Amit Sharma",
    username: "amit.sharma",
    email: "amit.sharma@citycare.in",
    password: "password123",
    mobile: "9876543210",
    role: "Doctor",
    department: "Cardiology",
    specialization: "Interventional Cardiologist",
    shift: "Morning (6AM-2PM)",
    licenseNumber: "MCI-45678",
  },
  {
    name: "Priya Patel",
    username: "priya.patel",
    email: "priya.patel@citycare.in",
    password: "password123",
    mobile: "9123456789",
    role: "Nurse",
    department: "General Ward",
    shift: "Evening (2PM-10PM)",
  },
  {
    name: "Rahul Verma",
    username: "rahul.verma",
    email: "rahul.verma@citycare.in",
    password: "admin123",
    mobile: "9988776655",
    role: "Admin",
    department: "Administration",
  },
  {
    name: "Dr. Sneha Gupta",
    username: "sneha.gupta",
    email: "sneha.gupta@citycare.in",
    password: "password123",
    mobile: "9871234567",
    role: "Doctor",
    department: "Pediatrics",
    specialization: "Pediatrician",
    shift: "Morning (6AM-2PM)",
    licenseNumber: "MCI-78901",
  },
  {
    name: "Avik Mallick",
    username: "avikmallick",
    email: "avikmallick14@gmail.com",
    password: "testuser",
    mobile: "9456789012",
    role: "Admin",
    department: "Administration",
    shift: "General Shift",
  },
];

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hospital_db");

    // Clear existing users (optional - comment out if you don't want to delete)
    await User.deleteMany({});
    console.log("🗑️  Cleared existing users");

    for (const userData of dummyUsers) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      await User.create({
        ...userData,
        password: hashedPassword,
      });

      console.log(`✅ Created user: ${userData.username} (${userData.role})`);
    }

    console.log("\n🎉 All dummy users inserted successfully!");
    console.log("\nYou can now login with:");
    console.log("• Admin:     rahul.verma  /  admin123");
    console.log("• Doctor:    amit.sharma  /  password123");
    console.log("• Nurse:     priya.patel  /  password123");

  } catch (error) {
    console.error("❌ Error seeding users:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

// Run the script
seedUsers();