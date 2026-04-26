import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  role: { 
    type: String, 
    enum: ["Admin", "Doctor", "Nurse", "Receptionist", "LabTech", "Pharmacist", "Accountant"],
    required: true 
  },
  department: { type: String },
  specialization: String,
  shift: String,
  licenseNumber: String,
  consultancyFees: String,
  joinDate: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("User", userSchema);