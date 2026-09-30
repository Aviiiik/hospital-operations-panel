import express from "express";
import jwt from "jsonwebtoken";
import * as diagnosticsService from "../services/diagnosticsService.js";

const router = express.Router();

// Every Diagnostics route is limited to Admin + Diagnostics users; deleting a
// patient (and their bill, same doc) is Admin only.
const requireRoles = (roles: string[]) => (req: any, res: any, next: any) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  try {
    const decoded: any = jwt.verify(auth.slice(7), process.env.JWT_SECRET || "fallback_secret");
    if (!roles.includes(decoded.role?.toLowerCase())) return res.status(403).json({ message: "Access denied" });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

const requireDiagnostics = requireRoles(["admin", "diagnostics"]);
const requireAdmin       = requireRoles(["admin"]);

// ─── Bill number preview ──────────────────────────────────────────────────────

router.get("/next-bill-no", requireDiagnostics, async (_req, res) => {
  try {
    res.json({ success: true, data: await diagnosticsService.getNextBillNo() });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Dashboard stats (?from&to, defaults to today IST) ───────────────────────

router.get("/stats/dashboard", requireDiagnostics, async (req, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    res.json({ success: true, data: await diagnosticsService.getDashboardStats(from, to) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Patients (each doc is the patient + their one bill) ─────────────────────

// Creates the patient and their bill together in a single call — there is no
// way to save a patient without submitting a bill in the same request.
router.post("/patients", requireDiagnostics, async (req, res) => {
  try {
    const patient = await diagnosticsService.createPatient(req.body);
    res.status(201).json({ success: true, data: patient });
  } catch (err: any) {
    const status = err.message.includes("required") ? 400 : 500;
    res.status(status).json({ message: err.message });
  }
});

router.get("/patients", requireDiagnostics, async (req, res) => {
  try {
    const patients = await diagnosticsService.searchPatients(req.query as any);
    res.json({ success: true, data: { patients } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/patients/:id", requireDiagnostics, async (req, res) => {
  try {
    const patient = await diagnosticsService.getPatient(req.params.id);
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Edits both the patient details and the bill in one call.
router.put("/patients/:id", requireDiagnostics, async (req, res) => {
  try {
    const patient = await diagnosticsService.updatePatient(req.params.id, req.body);
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json({ success: true, data: patient });
  } catch (err: any) {
    const status = err.message.includes("required") ? 400 : 500;
    res.status(status).json({ message: err.message });
  }
});

router.delete("/patients/:id", requireAdmin, async (req, res) => {
  try {
    const patient = await diagnosticsService.deletePatient(req.params.id);
    res.json({ success: true, data: patient });
  } catch (err: any) {
    const status = err.message === "Patient not found" ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
});

// ─── Test catalogue ──────────────────────────────────────────────────────────

// GET tests — active only by default, pass ?all=1 for the full catalogue
router.get("/tests", requireDiagnostics, async (req, res) => {
  try {
    const tests = await diagnosticsService.getTests(req.query.all !== "1");
    res.json({ success: true, data: { tests } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/tests", requireDiagnostics, async (req, res) => {
  try {
    const test = await diagnosticsService.createTest(req.body);
    res.status(201).json({ success: true, data: test });
  } catch (err: any) {
    const status = err.message.includes("already exists") || err.message.includes("required") ? 400 : 500;
    res.status(status).json({ message: err.message });
  }
});

router.put("/tests/:id", requireDiagnostics, async (req, res) => {
  try {
    const test = await diagnosticsService.updateTest(req.params.id, req.body);
    if (!test) return res.status(404).json({ message: "Test not found" });
    res.json({ success: true, data: test });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/tests/:id", requireDiagnostics, async (req, res) => {
  try {
    const test = await diagnosticsService.deleteTest(req.params.id);
    if (!test) return res.status(404).json({ message: "Test not found" });
    res.json({ success: true, data: test });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
