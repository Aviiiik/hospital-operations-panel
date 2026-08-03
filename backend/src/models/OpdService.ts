import mongoose, { Schema, Document } from "mongoose";

export interface IOpdService extends Document {
  serviceName: string;
  charge: number;
  isActive: boolean;
  sortOrder: number;
}

const OpdServiceSchema = new Schema<IOpdService>(
  {
    serviceName: { type: String, required: true, unique: true, trim: true, uppercase: true },
    charge:      { type: Number, default: 0 },
    isActive:    { type: Boolean, default: true },
    sortOrder:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

OpdServiceSchema.index({ isActive: 1 });

export default mongoose.model<IOpdService>("OpdService", OpdServiceSchema);