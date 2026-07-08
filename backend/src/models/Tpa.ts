import mongoose, { Schema, Document } from "mongoose";

export interface ITpa extends Document {
  name: string;
  isActive: boolean;
}

const TpaSchema = new Schema<ITpa>(
  {
    name:     { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TpaSchema.index({ isActive: 1, name: 1 });

export default mongoose.model<ITpa>("Tpa", TpaSchema);
