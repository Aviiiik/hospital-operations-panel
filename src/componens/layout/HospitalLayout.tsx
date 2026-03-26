// src/components/layout/HospitalLayout.tsx
import { useState } from "react";
import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Bed,
  Calendar,
  Pill,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { title: "OPD", icon: Calendar, path: "/opd" },
  { title: "IPD", icon: Bed, path: "/ipd" },
  { title: "Pharmacy", icon: Pill, path: "/pharmacy" },
  { title: "Operations", icon: Settings, path: "/operations" },
  { title: "Accounts", icon: DollarSign, path: "/accounts" },
  {
    title: "Users",
    icon: Users,
    path: "/users",
    submenu: [
      { title: "All Users", path: "/users" },
      { title: "Add User", path: "/users/add" },
    ],
  },
];

export default function HospitalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const handleLogout = () => {
    toast.success("Logged out successfully");
    // In real app, clear auth context here
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-72" : "w-20"
        } border-r bg-white transition-all duration-300 flex flex-col shadow-sm`}
      >
        <div className="h-16 border-b flex items-center px-6 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">C</span>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-xl tracking-tight">CityCare</h1>
                <p className="text-[10px] text-gray-500 -mt-1">HOSPITAL</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);

            return (
              <div key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-red-50 text-red-700 shadow-sm"
                      : "hover:bg-gray-100 text-gray-700"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {sidebarOpen && <span>{item.title}</span>}
                </Link>

                {/* Submenu for Users */}
                {item.submenu && sidebarOpen && isActive && (
                  <div className="ml-10 mt-1 space-y-1">
                    {item.submenu.map((sub) => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        className={`block px-4 py-2 text-sm rounded-lg transition-colors ${
                          location.pathname === sub.path
                            ? "text-red-700 font-medium bg-red-50"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        {sub.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom User Info */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-red-100 text-red-700">AD</AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="flex-1 text-sm">
                <p className="font-semibold">Admin User</p>
                <p className="text-gray-500 text-xs">Administrator</p>
              </div>
            )}
          </div>

          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {sidebarOpen && "Logout"}
          </Button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Hospital Operations Panel
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>

            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right text-sm">
                <p className="font-medium">Dr. Amit Sharma</p>
                <p className="text-xs text-gray-500">Medical Superintendent</p>
              </div>
              <Avatar>
                <AvatarFallback>AS</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}