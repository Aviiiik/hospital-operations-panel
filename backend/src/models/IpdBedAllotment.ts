import mongoose from "mongoose";

const ipdBedAllotmentSchema = new mongoose.Schema({
  patientId:        { type: mongoose.Schema.Types.ObjectId, ref: "IpdPatient", required: true },
  admissionId:      { type: String },
  bedCategory:      { type: String, required: true },
  bedNo:            { type: String, required: true },
  charge:           { type: Number, default: 0 },
  allotmentDate:    { type: Date, required: true },
  allotmentTime:    { type: String },
  endDate:          { type: Date },
  endTime:          { type: String },
  effectiveTime:    { type: String },
  effectiveEndTime: { type: String },
  packageDays:      { type: Number, default: 0 },
  includeInPackage: { type: Boolean, default: false },
  cashService:      { type: Boolean, default: false },
  isCurrent:        { type: Boolean, default: true },
  createdBy:        { type: String },
}, { timestamps: true });

ipdBedAllotmentSchema.index({ patientId: 1 });
ipdBedAllotmentSchema.index({ patientId: 1, isCurrent: 1 });

export default mongoose.model("IpdBedAllotment", ipdBedAllotmentSchema);
