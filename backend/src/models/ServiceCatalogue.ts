import mongoose, { Schema, Document } from "mongoose";

export interface IServiceCatalogue extends Document {
  serviceGroup: string;
  serviceGroupCode: string;
  serviceName: string;
  unit: string;
  defaultCharge: number;
  requiresDoctor: boolean;
  isReferral: boolean;
  isActive: boolean;
  sortOrder: number;
}

const ServiceCatalogueSchema = new Schema<IServiceCatalogue>(
  {
    serviceGroup:     { type: String, required: true },
    serviceGroupCode: { type: String, required: true },
    serviceName:      { type: String, required: true },
    unit:             { type: String, default: "" },
    defaultCharge:    { type: Number, default: 0 },
    requiresDoctor:   { type: Boolean, default: false },
    isReferral:       { type: Boolean, default: false },
    isActive:         { type: Boolean, default: true },
    sortOrder:        { type: Number, default: 0 },
  },
  { timestamps: true }
);

ServiceCatalogueSchema.index({ serviceGroup: 1, sortOrder: 1 });
ServiceCatalogueSchema.index({ serviceGroupCode: 1 });
ServiceCatalogueSchema.index({ isActive: 1 });

export default mongoose.model<IServiceCatalogue>("ServiceCatalogue", ServiceCatalogueSchema);
