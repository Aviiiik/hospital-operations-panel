import mongoose, { Schema, Document } from "mongoose";

export interface IInvestigationItem extends Document {
  slNo: number;
  name: string;
  category: string;
  labRate: number;
  patientRate: number;
  vendorCode: string;
  vendorName: string;
  isActive: boolean;
}

const InvestigationItemSchema = new Schema<IInvestigationItem>(
  {
    slNo:        { type: Number },
    name:        { type: String, required: true },
    category:    { type: String, required: true },
    labRate:     { type: Number, default: 0 },
    patientRate: { type: Number, default: 0 },
    vendorCode:  { type: String, required: true },
    vendorName:  { type: String },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

InvestigationItemSchema.index({ vendorCode: 1, isActive: 1 });
InvestigationItemSchema.index({ category: 1 });
InvestigationItemSchema.index({ name: "text" });

export default mongoose.model<IInvestigationItem>("InvestigationItem", InvestigationItemSchema);
