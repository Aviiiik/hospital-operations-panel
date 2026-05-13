import mongoose, { Schema, Document } from "mongoose";

export interface IInvestigationVendor extends Document {
  code: string;
  name: string;
  isActive: boolean;
}

const InvestigationVendorSchema = new Schema<IInvestigationVendor>(
  {
    code:     { type: String, required: true, unique: true },
    name:     { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

InvestigationVendorSchema.index({ isActive: 1, code: 1 });

export default mongoose.model<IInvestigationVendor>("InvestigationVendor", InvestigationVendorSchema);
