import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import opdService, { DESIGNATIONS } from "@/services/opdService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ArrowLeft, RefreshCw, Plus } from "lucide-react";

// Case-insensitive merge: keeps the first-seen casing, drops later duplicates, sorts A→Z.
const mergeUnique = (...lists: string[][]) => {
  const seen = new Map<string, string>();
  for (const v of lists.flat()) {
    const t = (v || "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (!seen.has(k)) seen.set(k, t);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
};

const BASE_DEPARTMENTS = ["OPD", "DIALYSIS", "EMERGENCY", "IMPLANT", "PROCEDURE", "Administration", "Pharmacy", "Reception"];

export default function AddDoctor() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.role.toLowerCase() !== "admin" && user.role.toLowerCase() !== "receptionist") {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    mobile: "",
    password: "",
    role: "Doctor",
    department: "",
    specialization: "",
    shift: "",
    licenseNumber: "",
    consultancyFees: "",
  });

  const shifts = ["Morning", "Evening", "Night", "General Shift"];

  const [departmentOptions, setDepartmentOptions] = useState<string[]>(() => mergeUnique(BASE_DEPARTMENTS));
  const [specializationOptions, setSpecializationOptions] = useState<string[]>(() => mergeUnique(DESIGNATIONS));

  const [addingDept, setAddingDept] = useState(false);
  const [newDept, setNewDept] = useState("");
  const [addingSpec, setAddingSpec] = useState(false);
  const [newSpec, setNewSpec] = useState("");

  // Pull every department/specialization already used by an existing doctor and fold
  // them into the dropdowns (case-insensitive dedupe).
  useEffect(() => {
    opdService
      .getAllDoctors()
      .then((r) => {
        const docs: any[] = r.data?.data?.doctors || [];
        setDepartmentOptions((prev) => mergeUnique(prev, docs.map((d) => d.department)));
        setSpecializationOptions((prev) => mergeUnique(prev, docs.map((d) => d.specialization)));
      })
      .catch(() => {
        /* non-fatal — fall back to the static lists */
      });
  }, []);

  const addDepartment = () => {
    const t = newDept.trim();
    if (!t) return;
    const existing = departmentOptions.find((o) => o.toLowerCase() === t.toLowerCase());
    if (existing) {
      setFormData((f) => ({ ...f, department: existing }));
      toast.info("That department already exists");
    } else {
      setDepartmentOptions((prev) => mergeUnique(prev, [t]));
      setFormData((f) => ({ ...f, department: t }));
      toast.success("Department added");
    }
    setNewDept("");
    setAddingDept(false);
  };

  const addSpecialization = () => {
    const t = newSpec.trim();
    if (!t) return;
    const existing = specializationOptions.find((o) => o.toLowerCase() === t.toLowerCase());
    if (existing) {
      setFormData((f) => ({ ...f, specialization: existing }));
      toast.info("That specialization already exists");
    } else {
      setSpecializationOptions((prev) => mergeUnique(prev, [t]));
      setFormData((f) => ({ ...f, specialization: t }));
      toast.success("Specialization added");
    }
    setNewSpec("");
    setAddingSpec(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%";
    let password = "";
    for (let i = 0; i < 10; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    setFormData({ ...formData, password });
    toast.success("Password generated successfully");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.username || !formData.mobile || !formData.password || !formData.department) {
      toast.error("Please fill all required fields");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (!(await confirm({ title: "Create doctor?", description: "This will add a new doctor.", confirmText: "Yes, create" }))) return;
    setLoading(true);
    try {
      await opdService.createDoctor(formData);
      toast.success("Doctor created successfully!");
      navigate("/doctors");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create doctor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" asChild>
          <Link to="/doctors">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Search Doctor
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Add New Doctor</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Doctor Registration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="space-y-2">
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Dr. Rajesh Kumar"
                  required
                />
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label>Username <span className="text-red-500">*</span></Label>
                <Input
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="rajesh.kumar"
                  required
                />
              </div>

              {/* Mobile */}
              <div className="space-y-2">
                <Label>Mobile Number <span className="text-red-500">*</span></Label>
                <Input
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  placeholder="9876543210"
                  maxLength={10}
                  required
                />
              </div>

              {/* Role — display only, fixed to Doctor */}
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value="Doctor" disabled className="bg-gray-100 text-gray-500 cursor-not-allowed" />
              </div>

              {/* Department */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Department <span className="text-red-500">*</span></Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => { setAddingDept((v) => !v); setNewDept(""); }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {addingDept ? "Cancel" : "Add new"}
                  </Button>
                </div>
                {addingDept ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={newDept}
                      onChange={(e) => setNewDept(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDepartment(); } }}
                      placeholder="New department name"
                    />
                    <Button type="button" size="sm" onClick={addDepartment}>Add</Button>
                  </div>
                ) : (
                  <Select value={formData.department} onValueChange={(value) => handleSelectChange("department", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Specialization */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Specialization</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => { setAddingSpec((v) => !v); setNewSpec(""); }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {addingSpec ? "Cancel" : "Add new"}
                  </Button>
                </div>
                {addingSpec ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={newSpec}
                      onChange={(e) => setNewSpec(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSpecialization(); } }}
                      placeholder="New specialization name"
                    />
                    <Button type="button" size="sm" onClick={addSpecialization}>Add</Button>
                  </div>
                ) : (
                  <Select value={formData.specialization} onValueChange={(value) => handleSelectChange("specialization", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Specialization" />
                    </SelectTrigger>
                    <SelectContent>
                      {specializationOptions.map((spec) => (
                        <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Shift */}
              <div className="space-y-2">
                <Label>Shift Timing</Label>
                <Select onValueChange={(value) => handleSelectChange("shift", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((shift) => (
                      <SelectItem key={shift} value={shift}>{shift}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* License Number */}
              <div className="space-y-2">
                <Label>License / Registration No.</Label>
                <Input
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleChange}
                  placeholder="MCI-12345"
                />
              </div>

              {/* Consultancy Fees */}
              <div className="space-y-2">
                <Label>Consultancy Fees (₹)</Label>
                <Input
                  name="consultancyFees"
                  value={formData.consultancyFees}
                  onChange={handleChange}
                  placeholder="e.g. 500"
                />
              </div>

              {/* Password */}
              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Password <span className="text-red-500">*</span></Label>
                  <Button type="button" variant="outline" size="sm" onClick={generatePassword}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate Password
                  </Button>
                </div>
                <Input
                  name="password"
                  type="text"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter password or click generate"
                  required
                />
                <p className="text-xs text-gray-500">Minimum 6 characters recommended</p>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t">
              <Button variant="outline" type="button" onClick={() => navigate("/doctors")}>
                Cancel
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700 px-8" disabled={loading}>
                {loading ? "Creating Doctor..." : "Create Doctor"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog />
    </div>
  );
}
