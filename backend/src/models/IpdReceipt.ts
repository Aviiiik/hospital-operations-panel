import mongoose from "mongoose";

const ipdReceiptSchema = new mongoose.Schema({
  patientId:     { type: mongoose.Schema.Types.ObjectId, ref: "IpdPatient", required: true },
  admissionId:   { type: String },
  receiptNo:     { type: String, required: true, unique: true },
  receiptDate:   { type: Date, required: true },
  receiptAmount: { type: Number, required: true, default: 0 },
  receiptMode:   { type: String, enum: ["CASH", "CHEQUE", "NEFT", "UPI", "CARD", "DD"], default: "CASH" },
  remarks:       { type: String },
  tds:           { type: Number, default: 0 },
  disallowed:    { type: Number, default: 0 },
  refund:        { type: Number, default: 0 },
  chequeNo:      { type: String },
  chequeRefNo:   { type: String },
  transactionId: { type: String },
  createdBy:     { type: String },
}, { timestamps: true });

ipdReceiptSchema.index({ patientId: 1 });

export default mongoose.model("IpdReceipt", ipdReceiptSchema);
