import mongoose from "mongoose";

const IpdBillingEntrySchema = new mongoose.Schema(
  {
    patientId:        { type: mongoose.Schema.Types.ObjectId, ref: "IpdPatient", required: true },
    serviceGroup:     { type: String, required: true },
    serviceGroupCode: { type: String },
    serviceName:      { type: String, required: true },
    unit:             { type: String },
    quantity:         { type: Number, default: 1 },
    unitCharge:       { type: Number, default: 0 },
    discount:         { type: Number, default: 0 },
    discountType:     { type: String, enum: ["flat", "percent"], default: "flat" },
    totalCharge:      { type: Number, default: 0 },
    date:             { type: Date, default: Date.now },
    doctorName:       { type: String },
    notes:            { type: String },
    isAutoAdded:      { type: Boolean, default: false },
    createdBy:        { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("IpdBillingEntry", IpdBillingEntrySchema);
