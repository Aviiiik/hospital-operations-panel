import mongoose from "mongoose";
import dotenv from "dotenv";
import InvestigationVendor from "../models/InvestigationVendor.js";
import InvestigationItem from "../models/InvestigationItem.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hospital";

const OLD_NAME = "AROGYA";
const NEW_NAME = "AROGYA DIAGNOSTIC";
const VENDOR_CODE = "AROGYA";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const vendor = await InvestigationVendor.findOneAndUpdate(
    { code: VENDOR_CODE },
    { $set: { name: NEW_NAME } },
    { returnDocument: "after" }
  );
  console.log(vendor
    ? `Vendor "${OLD_NAME}" (code ${VENDOR_CODE}) renamed to "${vendor.name}"`
    : `No vendor found with code "${VENDOR_CODE}" — skipped`);

  const result = await InvestigationItem.updateMany(
    { vendorCode: VENDOR_CODE },
    { $set: { vendorName: NEW_NAME } }
  );
  console.log(`Investigation items updated: ${result.modifiedCount} (matched: ${result.matchedCount})`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
