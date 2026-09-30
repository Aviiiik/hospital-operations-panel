import mongoose from "mongoose";

const testItemSchema = new mongoose.Schema({
  testName:   { type: String, required: true },
  // Copied from the catalogue test at billing time, so dashboard department
  // totals don't shift if a catalogue test is later re-categorised.
  department: { type: String, default: "" },
  charge:     { type: Number, required: true, default: 0 },
}, { _id: false });

// One DiagnosticPatient doc = one patient + their one bill — there is no
// separate bills collection. A patient can never exist without a bill: the
// service only ever creates the two together (createPatient requires tests),
// and the only edit path (updatePatient) edits both sections of the same doc.
// billNo is `<5-digit yearly serial>/<IST year>`, e.g. "00001/2026" — the only
// number in the Diagnostics module (no separate patient/registration id).
// billYear + billSerial are stored alongside it so the next serial can be
// found numerically (and uniquely indexed) instead of by string-sorting billNo.
const diagnosticPatientSchema = new mongoose.Schema({
  // ─── Patient details ───────────────────────────────────────────────────────
  title:           { type: String, default: "Mr", enum: ["Mr", "Mrs", "Ms", "Dr", "Baby", "Master"] },
  name:            { type: String, required: true },
  gender:          { type: String, enum: ["Male", "Female", "Other"], required: true },
  dob:             { type: Date },
  ageYears:        { type: Number, default: 0 },
  ageMonths:       { type: Number, default: 0 },
  ageDays:         { type: Number, default: 0 },
  nationality:     { type: String, default: "NATIONAL" },
  religion:        { type: String },
  caste:           { type: String },
  occupation:      { type: String },
  address:         { type: String },
  postOffice:      { type: String },
  policeStation:   { type: String },
  district:        { type: String },
  state:           { type: String },
  pin:             { type: String },
  phone:           { type: String, required: true },
  altPhone:        { type: String },
  email:           { type: String },
  city:            { type: String },
  country:         { type: String, default: "India" },
  referredBy:      { type: String },
  collCentre:      { type: String },
  organization:    { type: String },
  patientHistory:  { type: String },
  registrationDate: { type: Date, default: Date.now },
  isActive:        { type: Boolean, default: true },

  // ─── Bill (one per patient) ─────────────────────────────────────────────────
  billNo:          { type: String, required: true, unique: true },
  billYear:        { type: Number, required: true },
  billSerial:      { type: Number, required: true },
  billDate:        { type: Date, required: true },
  tests:           { type: [testItemSchema], required: true },
  totalAmount:     { type: Number, default: 0 },
  discount:        { type: Number, default: 0 },   // percent
  discountAmount:  { type: Number, default: 0 },
  billAmount:      { type: Number, default: 0 },
  paymentMode:     { type: String, enum: ["Cash", "Card", "UPI", "Other"], default: "Cash" },
  billRemarks:     { type: String },
}, { timestamps: true });

diagnosticPatientSchema.index({ billYear: 1, billSerial: 1 }, { unique: true });

export default mongoose.model("DiagnosticPatient", diagnosticPatientSchema);
