import mongoose from "mongoose";

const serviceItemSchema = new mongoose.Schema({
  serviceName: { type: String, required: true },
  charge:      { type: Number, required: true, default: 0 },
});

const opdBookingSchema = new mongoose.Schema({
  bookingId:      { type: String, required: true, unique: true },
  patient:        { type: mongoose.Schema.Types.ObjectId, ref: "OpdPatient", required: true },
  bookingNo:      { type: Number, required: true },
  department:     { type: String, required: true },
  doctorName:     { type: String, required: true },
  visitDate:      { type: Date, required: true },
  visitTime:      { type: String },
  serviceType:    { type: String, default: "CONSULTATION" },
  services:       [serviceItemSchema],
  totalAmount:    { type: Number, default: 0 },
  cardCharge:     { type: Number, default: 0 },
  discount:       { type: Number, default: 0 },
  billAmount:     { type: Number, default: 0 },
  
 
  status:         { type: String, enum: ["Paid", "Pending", "Cancelled"], default: "Paid" },
  remarks:        { type: String },
}, { timestamps: true });

export default mongoose.model("OpdBooking", opdBookingSchema);
