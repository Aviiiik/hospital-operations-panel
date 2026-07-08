import mongoose, { Schema, Document } from "mongoose";

export interface IInsuranceCompany extends Document {
  name: string;
  isActive: boolean;
}

const InsuranceCompanySchema = new Schema<IInsuranceCompany>(
  {
    name:     { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

InsuranceCompanySchema.index({ isActive: 1, name: 1 });

export default mongoose.model<IInsuranceCompany>("InsuranceCompany", InsuranceCompanySchema);
