import mongoose from "mongoose";

const pharmacyMedicineSchema = new mongoose.Schema({
  itemCode:     { type: String, required: true, unique: true },
  termName:     { type: String, required: true },
  unitName:     { type: String, default: "" },
  packingPower: { type: String, default: "" },
  boxNo:        { type: String, default: "" },
  mrp:          { type: Number, default: 0 },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("PharmacyMedicine", pharmacyMedicineSchema);
