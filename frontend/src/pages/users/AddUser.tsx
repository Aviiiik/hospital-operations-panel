// src/pages/users/AddUser.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "@/lib/Api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";

export default function AddUser() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    mobile: "",
    password: "",
    role: "",
    department: "",
    specialization: "",
    shift: "",
    licenseNumber: "",
    consultancyFees: "",
  });

  const roles = ["Doctor", "Nurse", "Admin", "Receptionist", "LabTech", "Pharmacist", "Accountant"];
  const departments = ["OPD", "DIALYSIS", "EMERGENCY", "IMPLANT", "PROCEDURE","Administration", "Pharmacy","Reception"];

  const shifts = ["Morning", "Evening", "Night", "General Shift"];

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

    // Basic validation
    if (!formData.name || !formData.username || !formData.mobile || !formData.password ||
        !formData.role || !formData.department) {
      toast.error("Please fill all required fields");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/users", formData);
      
      toast.success("User created successfully!");
      navigate("/users");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" asChild>
          <Link to="/users">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Users
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Add New Hospital Staff</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Registration</CardTitle>
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

              {/* Role */}
              <div className="space-y-2">
                <Label>Role <span className="text-red-500">*</span></Label>
                <Select onValueChange={(value) => handleSelectChange("role", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label>Department<span className="text-red-500">*</span> </Label>
                <Select onValueChange={(value) => handleSelectChange("department", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Specialization */}
              <div className="space-y-2">
                <Label>Specialization</Label>
                <Input
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleChange}
                  placeholder="e.g. Interventional Cardiologist"
                />
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

              {/* Password - Manual Input + Generate Button */}
              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Password <span className="text-red-500">*</span></Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generatePassword}
                  >
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
                <p className="text-xs text-gray-500">
                  Minimum 6 characters recommended
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t">
              <Button variant="outline" type="button" onClick={() => navigate("/users")}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-red-600 hover:bg-red-700 px-8"
                disabled={loading}
              >
                {loading ? "Creating User..." : "Create User"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}