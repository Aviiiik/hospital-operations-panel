import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
  medicineName: { type: String, required: true },
  dosage:       { type: String, default: "" },
  frequency:    { type: String, default: "" },
  duration:     { type: String, default: "" },
  instructions: { type: String, default: "" },
}, { _id: false });

const opdPrescriptionSchema = new mongoose.Schema({
  prescriptionId: { type: String, unique: true, required: true },
  patient:        { type: mongoose.Schema.Types.ObjectId, ref: "OpdPatient", required: true },
  doctorName:     { type: String, required: true },
  visitDate:      { type: Date, required: true },
  medicines:      [medicineSchema],
  remarks:        { type: String, default: "" },
}, { timestamps: true });

export default mongoose.model("OpdPrescription", opdPrescriptionSchema);
