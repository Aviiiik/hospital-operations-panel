// src/pages/auth/Login.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { GalleryVerticalEnd, RefreshCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import api from "@/lib/Api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function HospitalLogin() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const { login } = useAuth();

  // Clear fields every time user visits login page
  useEffect(() => {
    const clearFields = () => {
      setCredentials({ username: "", password: "" });
      setShowPassword(false);
      if (usernameRef.current) usernameRef.current.value = "";
      if (passwordRef.current) passwordRef.current.value = "";
    };

    clearFields();
    const timeout = setTimeout(clearFields, 50); // Extra protection against autofill

    return () => clearTimeout(timeout);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!credentials.username || !credentials.password) {
      toast.error("Please enter username and password");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/login", credentials);
      
      const { user, token } = response.data.data;

      // Use AuthContext to login
      login(user, token);

      toast.success(`Welcome back, ${user.name}!`);
      navigate("/dashboard");
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Invalid credentials";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left Banner */}
      <div className="relative hidden lg:block bg-muted">
        <img
          src="https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=1200"
          alt="CityCare Hospital"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-transparent" />
        <div className="absolute bottom-12 left-12 text-white">
          <h1 className="text-5xl font-bold">Arogya Maternity and Nursing home</h1>
          <p className="mt-3 text-xl">A Unit of RP Medical Foundation Pvt Ltd</p>
        </div>
      </div>

      {/* Login Form */}
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center gap-4 mb-10 text-center">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center">
              <GalleryVerticalEnd className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Sign In</h2>
              <p className="text-muted-foreground mt-1">Access your hospital operations panel</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                ref={usernameRef}
                id="username"
                name="username"
                type="text"
                placeholder="e.g. rahul.verma"
                value={credentials.username}
                onChange={handleChange}
                disabled={loading}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
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

          <p className="text-center text-xs text-muted-foreground mt-10">
            © 2026 Arogya Maternity and Nursing home • All Rights Reserved
          </p>
        </div>
      </div>
    </div>
  );
}