// src/components/layout/HospitalLayout.tsx
import { useState } from "react";
import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Users, Bed, Pill,
  DollarSign, Settings, LogOut, Menu, X, Bell,
  Calendar, UserPlus, UserCheck, Stethoscope, ChevronDown, FileText, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import ChangePasswordModal from "@/pages/users/components/ChangePasswordModal";

interface SubItem { title: string; path: string; icon: React.ElementType; }
interface NavItem  {
  title: string; icon: React.ElementType; path: string;
  roles?: string[]; subItems?: SubItem[];
}

const ALL_NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  {
    title: "OPD", icon: Calendar, path: "/opd",
    roles: ["admin", "receptionist"],
    subItems: [
      { title: "New Patient",        path: "/opd/new-patient",   icon: UserPlus },
      { title: "Registered Patient", path: "/opd/registered",    icon: UserCheck },
      { title: "Search Doctor",      path: "/opd/search-doctor", icon: Stethoscope },
      { title: "E-Prescription",    path: "/opd/e-prescription", icon: FileText },
    ],
  },
  { title: "IPD",       icon: Bed,          path: "/ipd",        roles: ["admin", "receptionist"] },
  { title: "Pharmacy",  icon: Pill,         path: "/pharmacy",   roles: ["admin", "pharmacist", "doctor", "nurse"] },
  { title: "Accounts",  icon: DollarSign,   path: "/accounts",   roles: ["admin", "accountant", "labtech"] },
  { title: "Operations",icon: Settings,     path: "/operations", roles: ["admin", "labtech"] },
  { title: "Users",     icon: Users,        path: "/users",      roles: ["admin"] },
];

export default function HospitalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;

  const role = user.role.toLowerCase();
  const navItems = ALL_NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role));

  const isOpdActive = location.pathname.startsWith("/opd");

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-72" : "w-20"} border-r bg-white transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="h-16 border-b flex items-center px-6 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-2xl">C</span>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-xl leading-tight">Arogya</h1>
                <p className="text-[10px] text-gray-400 leading-tight">Maternal &amp; Nursing Home</p>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = location.pathname.startsWith(item.path);

            if (item.subItems) {
              const showSubs = sidebarOpen && isActive;
              return (
                <div key={item.path}>
                  <Link
                    to={item.subItems[0].path}
                    title={!sidebarOpen ? item.title : undefined}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive ? "bg-red-50 text-red-700 shadow-sm" : "hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="flex-1">{item.title}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpdActive ? "rotate-180" : ""}`} />
                      </>
                    )}
                  </Link>

                  {showSubs && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-red-100 pl-3">
                      {item.subItems.map(sub => {
                        const subActive = location.pathname === sub.path;
                        return (
                          <Link
                            key={sub.path}
                            to={sub.path}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              subActive ? "bg-red-100 text-red-700" : "hover:bg-gray-100 text-gray-600"
                            }`}
                          >
                            <sub.icon className="h-3.5 w-3.5 shrink-0" />
                            {sub.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                title={!sidebarOpen ? item.title : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive ? "bg-red-50 text-red-700 shadow-sm" : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {sidebarOpen && <span>{item.title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info & Logout */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-red-100 text-red-700 font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{user.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
            )}
          </div>
          <Button
            onClick={() => setIsChangePasswordOpen(true)}
            variant="ghost"
            className="w-full justify-start text-gray-600 hover:bg-gray-100"
            title={!sidebarOpen ? "Change Password" : undefined}
          >
            <KeyRound className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span className="ml-2">Change Password</span>}
          </Button>
          <Button
            onClick={logout}
            variant="ghost"
            className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
            title={!sidebarOpen ? "Logout" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span className="ml-2">Logout</span>}
          </Button>
        </div>

        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          user={user}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b px-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Hospital Operations Panel</h2>
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon"><Bell className="h-5 w-5" /></Button>
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", month: "short", day: "numeric" })}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
