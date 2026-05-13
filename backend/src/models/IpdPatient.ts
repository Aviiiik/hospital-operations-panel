import mongoose from "mongoose";

const ipdPatientSchema = new mongoose.Schema({
  admissionId:    { type: String, required: true, unique: true },
  admissionDate:  { type: Date, required: true, default: Date.now },
  admissionTime:  { type: String },
  title:          { type: String, default: "Mr", enum: ["Mr", "Mrs", "Ms", "Dr", "Baby", "Master"] },
  name:           { type: String, required: true },
  gender:         { type: String, enum: ["Male", "Female", "Other"], required: true },
  dob:            { type: Date },
  ageYears:       { type: Number, default: 0 },
  ageMonths:      { type: Number, default: 0 },
  ageDays:        { type: Number, default: 0 },
  bloodGroup:     { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""] },
  dietType:       { type: String },
  nationality:    { type: String, default: "NATIONAL" },
  religion:       { type: String },
  occupation:     { type: String },

  // Contact
  address:        { type: String },
  phone:          { type: String, required: true },
  altPhone:       { type: String },
  email:          { type: String },
  postOffice:     { type: String },
  city:           { type: String },
  policeStation:  { type: String },
  district:       { type: String },
  state:          { type: String },
  pin:            { type: String },
  country:        { type: String, default: "India" },
  localAddress:   { type: String },

  // Guardian
  familyPerson:        { type: String },
  guardianName:        { type: String },
  guardianRelation:    { type: String },
  relationWithPatient: { type: String },
  guardianPhone:       { type: String },
  guardianAddress:     { type: String },

  // Admission
  department:         { type: String },
  bedCategory:        { type: String },
  bedNo:              { type: String },
  treatmentCategory:  { type: String },

  // Doctors
  doctors: [{
    slNo:       { type: Number },
    doctorName: { type: String },
  }],

  // Other
  referredBy:     { type: String },
  organization:   { type: String },
  patientHistory: { type: String },
  remarks:        { type: String },
  remarksAccount: { type: String },

  // Package
  packageName:   { type: String },
  packageCharge: { type: Number, default: 0 },

  // TPA
  patientCategory: { type: String },
  insuranceCo:     { type: String },
  tpa:             { type: String },
  cardNo:          { type: String },
  policyNo:        { type: String },
  claimNo:         { type: String },
  ipdRegistrationNo: { type: String },
  otherDetails:    { type: String },

  // Link to OPD patient (optional)
  opdPatientId:  { type: String },
  admittedBy:    { type: String },

  // Saved bed charge override (manual lock-in from billing page)
  bedChargeOverride: { type: Number, default: null },

  // Manual estimate end date for open allotments (synced across all pages)
  estimateEndDate: { type: Date, default: null },
  estimateEndTime: { type: String, default: null },

  // Status & Discharge
  status:             { type: String, enum: ["Admitted", "Discharged"], default: "Admitted" },
  dischargeDate:      { type: Date },
  dischargeTime:      { type: String },
  dischargeType:      { type: String },
  referredTo:         { type: String },
  dischargeNote:      { type: String },
  adviceOnDischarge:  { type: String },

  // Structured discharge summary sections
  dischargeDiagnosis:   { type: String },
  chiefComplaint:       { type: String },
  onExamination:        { type: String },
  pastHistory:          { type: String },
  investigationSummary: { type: String },
  treatmentDetails:     { type: String },
}, { timestamps: true });

export default mongoose.model("IpdPatient", ipdPatientSchema);
