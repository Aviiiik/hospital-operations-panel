import express from "express";
import jwt from "jsonwebtoken";
import * as ipdService from "../services/ipdService.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

function decodeRole(req: any): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const decoded: any = jwt.verify(auth.slice(7), JWT_SECRET);
    return decoded.role?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

const requireAdminOrReceptionist = (req: any, res: any, next: any) => {
  const role = decodeRole(req);
  if (!role) return res.status(401).json({ message: "Unauthorized" });
  if (role !== "admin" && role !== "receptionist")
    return res.status(403).json({ message: "Access denied" });
  next();
};

const requireAdmin = (req: any, res: any, next: any) => {
  const role = decodeRole(req);
  if (!role) return res.status(401).json({ message: "Unauthorized" });
  if (role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
};

// ─── Dashboard stats ──────────────────────────────────────────────────────────

router.get("/stats", requireAdminOrReceptionist, async (req, res) => {
  try {
    const stats = await ipdService.getIpdDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Bed routes ───────────────────────────────────────────────────────────────

router.get("/beds/occupied", requireAdminOrReceptionist, async (req, res) => {
  try {
    const beds = await ipdService.getOccupiedBeds();
    res.json({ success: true, data: { beds } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Patient routes ───────────────────────────────────────────────────────────

router.get("/patients/next-id", requireAdminOrReceptionist, async (req, res) => {
  try {
    const data = await ipdService.getNextAdmissionPreview();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/patients", requireAdminOrReceptionist, async (req, res) => {
  try {
    const patient = await ipdService.createIpdPatient(req.body);
    res.status(201).json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/patients", requireAdminOrReceptionist, async (req, res) => {
  try {
    const patients = await ipdService.searchIpdPatients(req.query as any);
    res.json({ success: true, data: { patients } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/patients/:id", requireAdmin, async (req, res) => {
  try {
    const patient = await ipdService.getIpdPatient(req.params.id);
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/patients/:id", requireAdmin, async (req, res) => {
  try {
    const patient = await ipdService.updateIpdPatient(req.params.id, req.body);
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Delete patient (and associated investigations/billing/bed allotments/receipts/pharmacy bills)
router.delete("/patients/:id", requireAdmin, async (req, res) => {
  try {
    const patient = await ipdService.deleteIpdPatient(req.params.id);
    res.json({ success: true, data: patient });
  } catch (err: any) {
    const status = err.message === "Patient not found" ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

// ─── Investigation routes ─────────────────────────────────────────────────────

router.get("/investigations/patient/:patientId", requireAdminOrReceptionist, async (req, res) => {
  try {
    const list = await ipdService.getPatientInvestigations(req.params.patientId);
    res.json({ success: true, data: { investigations: list } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/investigations/patient/:patientId", requireAdminOrReceptionist, async (req, res) => {
  try {
    const inv = await ipdService.createInvestigation(req.params.patientId, req.body);
    res.status(201).json({ success: true, data: inv });
  } catch (err: any) {
    const status = err.message === "Patient not found" ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

router.get("/investigations/:id", requireAdminOrReceptionist, async (req, res) => {
  try {
    const inv = await ipdService.getInvestigation(req.params.id);
    if (!inv) return res.status(404).json({ message: "Investigation not found" });
    res.json({ success: true, data: inv });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/investigations/:id", requireAdmin, async (req, res) => {
  try {
    const inv = await ipdService.updateInvestigation(req.params.id, req.body);
    if (!inv) return res.status(404).json({ message: "Investigation not found" });
    res.json({ success: true, data: inv });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/investigations/:id", requireAdmin, async (req, res) => {
  try {
    const inv = await ipdService.deleteInvestigation(req.params.id);
    if (!inv) return res.status(404).json({ message: "Investigation not found" });
    res.json({ success: true, data: inv });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Billing routes ───────────────────────────────────────────────────────────

router.get("/billing/:patientId", requireAdmin, async (req, res) => {
  try {
    const entries = await ipdService.getBillingEntries(req.params.patientId);
    res.json({ success: true, data: { entries } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/billing/:patientId", requireAdmin, async (req, res) => {
  try {
    const entry = await ipdService.createBillingEntry(req.params.patientId, req.body);
    res.status(201).json({ success: true, data: entry });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/billing/entry/:id", requireAdmin, async (req, res) => {
  try {
    const entry = await ipdService.updateBillingEntry(req.params.id, req.body);
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/billing/entry/:id", requireAdmin, async (req, res) => {
  try {
    const entry = await ipdService.deleteBillingEntry(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Billing summary (gross / discount / net) — used by discharge page
router.get("/billing/:patientId/summary", requireAdmin, async (req, res) => {
  try {
    const summary = await ipdService.getBillingSummary(req.params.patientId);
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Service Catalogue routes ─────────────────────────────────────────────────

// GET all services (admin + receptionist can read)
router.get("/service-catalogue", requireAdminOrReceptionist, async (req, res) => {
  try {
    const activeOnly = req.query.all !== "1";
    const items = await ipdService.getServiceCatalogue(activeOnly);
    res.json({ success: true, data: { items } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST create service (admin only)
router.post("/service-catalogue", requireAdmin, async (req, res) => {
  try {
    const item = await ipdService.createServiceCatalogueItem(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update service (admin only)
router.put("/service-catalogue/:id", requireAdmin, async (req, res) => {
  try {
    const item = await ipdService.updateServiceCatalogueItem(req.params.id, req.body);
    if (!item) return res.status(404).json({ message: "Service not found" });
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE service (admin only)
router.delete("/service-catalogue/:id", requireAdmin, async (req, res) => {
  try {
    const item = await ipdService.deleteServiceCatalogueItem(req.params.id);
    if (!item) return res.status(404).json({ message: "Service not found" });
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Vendor routes ────────────────────────────────────────────────────────────

router.get("/vendors", requireAdminOrReceptionist, async (req, res) => {
  try {
    const activeOnly = req.query.all !== "1";
    const vendors = await ipdService.getVendors(activeOnly);
    res.json({ success: true, data: { vendors } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/vendors", requireAdminOrReceptionist, async (req, res) => {
  try {
    const vendor = await ipdService.createVendor(req.body);
    res.status(201).json({ success: true, data: vendor });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/vendors/:id", requireAdmin, async (req, res) => {
  try {
    const vendor = await ipdService.updateVendor(req.params.id, req.body);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.json({ success: true, data: vendor });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/vendors/:id", requireAdmin, async (req, res) => {
  try {
    const vendor = await ipdService.deleteVendor(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.json({ success: true, data: vendor });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Insurance Company routes ─────────────────────────────────────────────────

router.get("/insurance-companies", requireAdminOrReceptionist, async (req, res) => {
  try {
    const activeOnly = req.query.all !== "1";
    const companies = await ipdService.getInsuranceCompanies(activeOnly);
    res.json({ success: true, data: { companies } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/insurance-companies", requireAdminOrReceptionist, async (req, res) => {
  try {
    const company = await ipdService.createInsuranceCompany(req.body);
    res.status(201).json({ success: true, data: company });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/insurance-companies/:id", requireAdmin, async (req, res) => {
  try {
    const company = await ipdService.updateInsuranceCompany(req.params.id, req.body);
    if (!company) return res.status(404).json({ message: "Insurance company not found" });
    res.json({ success: true, data: company });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/insurance-companies/:id", requireAdmin, async (req, res) => {
  try {
    const company = await ipdService.deleteInsuranceCompany(req.params.id);
    if (!company) return res.status(404).json({ message: "Insurance company not found" });
    res.json({ success: true, data: company });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── TPA routes ───────────────────────────────────────────────────────────────

router.get("/tpas", requireAdminOrReceptionist, async (req, res) => {
  try {
    const activeOnly = req.query.all !== "1";
    const tpas = await ipdService.getTpas(activeOnly);
    res.json({ success: true, data: { tpas } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/tpas", requireAdminOrReceptionist, async (req, res) => {
  try {
    const tpa = await ipdService.createTpa(req.body);
    res.status(201).json({ success: true, data: tpa });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/tpas/:id", requireAdmin, async (req, res) => {
  try {
    const tpa = await ipdService.updateTpa(req.params.id, req.body);
    if (!tpa) return res.status(404).json({ message: "TPA not found" });
    res.json({ success: true, data: tpa });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/tpas/:id", requireAdmin, async (req, res) => {
  try {
    const tpa = await ipdService.deleteTpa(req.params.id);
    if (!tpa) return res.status(404).json({ message: "TPA not found" });
    res.json({ success: true, data: tpa });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Investigation Items routes ───────────────────────────────────────────────

router.get("/investigation-items", requireAdminOrReceptionist, async (req, res) => {
  try {
    const activeOnly = req.query.all !== "1";
    const vendorCode = req.query.vendorCode as string | undefined;
    const items = await ipdService.getInvestigationItems(vendorCode, activeOnly);
    res.json({ success: true, data: { items } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/investigation-items", requireAdmin, async (req, res) => {
  try {
    const item = await ipdService.createInvestigationItem(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/investigation-items/:id", requireAdmin, async (req, res) => {
  try {
    const item = await ipdService.updateInvestigationItem(req.params.id, req.body);
    if (!item) return res.status(404).json({ message: "Investigation item not found" });
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/investigation-items/:id", requireAdmin, async (req, res) => {
  try {
    const item = await ipdService.deleteInvestigationItem(req.params.id);
    if (!item) return res.status(404).json({ message: "Investigation item not found" });
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Bed Allotment routes ─────────────────────────────────────────────────────

router.get("/bed-allotments/:patientId", requireAdminOrReceptionist, async (req, res) => {
  try {
    const allotments = await ipdService.getBedAllotments(req.params.patientId);
    res.json({ success: true, data: { allotments } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/bed-allotments/:patientId/summary", requireAdminOrReceptionist, async (req, res) => {
  try {
    const summary = await ipdService.getBedAllotmentSummary(req.params.patientId);
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/bed-allotments/:patientId", requireAdmin, async (req, res) => {
  try {
    const allotment = await ipdService.createBedAllotment(req.params.patientId, req.body);
    res.status(201).json({ success: true, data: allotment });
  } catch (err: any) {
    const status = err.message === "Patient not found" ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

router.put("/bed-allotments/entry/:id", requireAdmin, async (req, res) => {
  try {
    const allotment = await ipdService.updateBedAllotment(req.params.id, req.body);
    if (!allotment) return res.status(404).json({ message: "Allotment not found" });
    res.json({ success: true, data: allotment });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/bed-allotments/entry/:id", requireAdmin, async (req, res) => {
  try {
    const allotment = await ipdService.deleteBedAllotment(req.params.id);
    if (!allotment) return res.status(404).json({ message: "Allotment not found" });
    res.json({ success: true, data: allotment });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Receipt routes ───────────────────────────────────────────────────────────

router.get("/receipts/:patientId", requireAdmin, async (req, res) => {
  try {
    const receipts = await ipdService.getReceipts(req.params.patientId);
    res.json({ success: true, data: { receipts } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/receipts/:patientId/summary", requireAdmin, async (req, res) => {
  try {
    const summary = await ipdService.getReceiptSummary(req.params.patientId);
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/receipts/:patientId", requireAdmin, async (req, res) => {
  try {
    const receipt = await ipdService.createReceipt(req.params.patientId, req.body);
    res.status(201).json({ success: true, data: receipt });
  } catch (err: any) {
    const status = err.message === "Patient not found" ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

router.put("/receipts/entry/:id", requireAdmin, async (req, res) => {
  try {
    const receipt = await ipdService.updateReceipt(req.params.id, req.body);
    if (!receipt) return res.status(404).json({ message: "Receipt not found" });
    res.json({ success: true, data: receipt });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/receipts/entry/:id", requireAdmin, async (req, res) => {
  try {
    const receipt = await ipdService.deleteReceipt(req.params.id);
    if (!receipt) return res.status(404).json({ message: "Receipt not found" });
    res.json({ success: true, data: receipt });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Pharmacy Bill routes ─────────────────────────────────────────────────────

router.get("/pharmacy/:patientId/total", requireAdminOrReceptionist, async (req, res) => {
  try {
    const data = await ipdService.getPharmacyTotal(req.params.patientId);
    res.json({ success: true, data });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.get("/pharmacy/:patientId", requireAdminOrReceptionist, async (req, res) => {
  try {
    const bills = await ipdService.getPharmacyBills(req.params.patientId);
    res.json({ success: true, data: { bills } });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post("/pharmacy/:patientId", requireAdminOrReceptionist, async (req, res) => {
  try {
    const bill = await ipdService.createPharmacyBill(req.params.patientId, req.body);
    res.status(201).json({ success: true, data: bill });
  } catch (err: any) {
    const status = err.message === "Patient not found" ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

router.put("/pharmacy/bill/:id", requireAdmin, async (req, res) => {
  try {
    const bill = await ipdService.updatePharmacyBill(req.params.id, req.body);
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    res.json({ success: true, data: bill });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.delete("/pharmacy/bill/:id", requireAdmin, async (req, res) => {
  try {
    const bill = await ipdService.deletePharmacyBill(req.params.id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    res.json({ success: true, data: bill });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── Pharmacy Medicine Catalog routes ─────────────────────────────────────────

router.get("/pharmacy-medicines", requireAdminOrReceptionist, async (req, res) => {
  try {
    const activeOnly = req.query.all !== "1";
    const medicines = await ipdService.getMedicines(activeOnly);
    res.json({ success: true, data: { medicines } });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.post("/pharmacy-medicines", requireAdmin, async (req, res) => {
  try {
    const med = await ipdService.createMedicine(req.body);
    res.status(201).json({ success: true, data: med });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.put("/pharmacy-medicines/:id", requireAdmin, async (req, res) => {
  try {
    const med = await ipdService.updateMedicine(req.params.id, req.body);
    if (!med) return res.status(404).json({ message: "Medicine not found" });
    res.json({ success: true, data: med });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

router.delete("/pharmacy-medicines/:id", requireAdmin, async (req, res) => {
  try {
    const med = await ipdService.deleteMedicine(req.params.id);
    if (!med) return res.status(404).json({ message: "Medicine not found" });
    res.json({ success: true, data: med });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
