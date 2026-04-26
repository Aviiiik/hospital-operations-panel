// backend/src/routes/userRoutes.ts
import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

// Create New User
router.post("/", async (req, res) => {
  try {
    const { name, username, password, mobile, role, department, specialization, shift, licenseNumber, consultancyFees } = req.body;

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: "User with this username already exists" });
    }
    const existingMobile = await User.findOne({ mobile });
    if (existingMobile) {
      return res.status(400).json({ message: "User with this mobile number already exists" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      username,
      password: hashedPassword,
      mobile,
      role,
      department,
      specialization,
      shift,
      licenseNumber,
      consultancyFees,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get All Users
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({
      success: true,
      data: { users },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get Single User
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      success: true,
      data: { user },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Update User
router.put("/:id", async (req, res) => {
  try {
    const { name, username, mobile, role, department, specialization, shift, licenseNumber, consultancyFees } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, username, mobile, role, department, specialization, shift, licenseNumber, consultancyFees },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Delete User
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;