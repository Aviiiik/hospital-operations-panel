import mongoose from "mongoose";

const pharmacyItemSchema = new mongoose.Schema({
  itemName:    { type: String, required: true },
  package:     { type: String, default: "" },
  batchNo:     { type: String, default: "" },
  expiryDate:  { type: String, default: "" },
  mrp:         { type: Number, default: 0 },
  pQty:        { type: Number, default: 1 },
  unit:        { type: String, default: "" },
  qty:         { type: Number, default: 1 },
  totalAmount: { type: Number, default: 0 },
  discount:     { type: Number, default: 0 },
  discountType: { type: String, default: "%" },
  netAmount:    { type: Number, default: 0 },
}, { _id: false });

const ipdPharmacyBillSchema = new mongoose.Schema({
  patientId:    { type: mongoose.Schema.Types.ObjectId, ref: "IpdPatient", required: true },
  admissionId:  { type: String },
  billNo:       { type: String, required: true, unique: true },
  billDate:     { type: Date, default: Date.now },
  referredBy:   { type: String, default: "" },
  vendor:       { type: String, default: "" },
  vendorBillNo: { type: String, default: "" },
  items:        [pharmacyItemSchema],
  totalAmount:  { type: Number, default: 0 },
  netAmount:    { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("IpdPharmacyBill", ipdPharmacyBillSchema);
