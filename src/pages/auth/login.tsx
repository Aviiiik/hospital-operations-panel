// src/pages/auth/Login.tsx
import { GalleryVerticalEnd, RefreshCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import hospitalBanner from "@/assets/hospital-banner.webp"; // Add your image here
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function HospitalLogin() {
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!credentials.email || !credentials.password) {
      toast.error("Please enter email and password");
      return;
    }

    setLoading(true);

    // Simulate API call (No backend yet)
    setTimeout(() => {
      toast.success("Login successful! Welcome to CityCare Hospital");
      navigate("/dashboard");
      setLoading(false);
    }, 1000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left Side - Banner */}
      <div className="relative hidden lg:block bg-muted">
        <img
          src={hospitalBanner || "https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=1200"}
          alt="CityCare Hospital"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-transparent" />

        <div className="absolute bottom-12 left-12 text-white">
          <h1 className="text-5xl font-bold tracking-tight">CityCare Hospital</h1>
          <p className="mt-3 text-xl text-white/90">
            Advanced Hospital Operations Management System
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex flex-col items-center justify-center p-6 md:p-10 bg-white">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center gap-2 text-center mb-8">
            <div className="flex items-center gap-3">
              <GalleryVerticalEnd className="h-12 w-12 text-red-600" />
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Operations Panel</h2>
                <p className="text-sm text-muted-foreground mt-1">Sign in to continue</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@citycarehospital.com"
                value={credentials.email}
                onChange={handleChange}
                className="h-12"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-sm text-red-600 hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={handleChange}
                  className="h-12 pr-12"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-red-600 hover:bg-red-700 text-base font-medium"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCcw className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-8">
            © 2026 CityCare Hospital • All Rights Reserved
          </p>
        </div>
      </div>
    </div>
  );
}