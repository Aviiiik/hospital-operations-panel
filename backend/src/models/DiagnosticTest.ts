import mongoose, { Schema, Document } from "mongoose";

export interface IDiagnosticTest extends Document {
  testName: string;
  department: string;
  charge: number;
  isActive: boolean;
  sortOrder: number;
}

const DiagnosticTestSchema = new Schema<IDiagnosticTest>(
  {
    testName:   { type: String, required: true, unique: true, trim: true, uppercase: true },
    department: { type: String, default: "", trim: true, uppercase: true }, // e.g. RADIOLOGY, CARDIOLOGY
    charge:    { type: Number, default: 0 },
    isActive:  { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

DiagnosticTestSchema.index({ isActive: 1 });

export default mongoose.model<IDiagnosticTest>("DiagnosticTest", DiagnosticTestSchema);
