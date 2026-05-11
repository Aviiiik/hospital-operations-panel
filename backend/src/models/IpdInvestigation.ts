import mongoose from "mongoose";

const investigationItemSchema = new mongoose.Schema({
  slNo:        { type: Number },
  code:        { type: String },
  description: { type: String, required: true },
  amount:      { type: Number, default: 0 },
  reportDate:  { type: Date },
  remark:      { type: String },
  category:    { type: String },
  caseNo:      { type: String },
  netAmount:   { type: Number, default: 0 },
}, { _id: false });

const ipdInvestigationSchema = new mongoose.Schema({
  reqNo:            { type: String, required: true, unique: true },
  ipdPatientId:     { type: mongoose.Schema.Types.ObjectId, ref: "IpdPatient", required: true },
  admissionId:      { type: String, required: true },

  reqDate:          { type: Date, default: Date.now },
  reqTime:          { type: String },
  collectionCentre: { type: String, default: "IPD" },

  patientName:      { type: String },
  guardianName:     { type: String },
  sex:              { type: String },
  ageYears:         { type: Number },
  ageMonths:        { type: Number },
  ageDays:          { type: Number },
  bedDetails:       { type: String },
  patientHistory:   { type: String },
  phone:            { type: String },
  referredBy:       { type: String },
  remarks:          { type: String },
  organisation:     { type: String },
  vendor:           { type: String },
  vendorBillNo:     { type: String },
  isUrgent:         { type: Boolean, default: false },

  items:       [investigationItemSchema],
  totalAmount: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("IpdInvestigation", ipdInvestigationSchema);
