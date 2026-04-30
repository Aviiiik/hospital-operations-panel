// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import HospitalLogin from "./pages/auth/Login";
import HospitalLayout from "./components/layout/HospitalLayout";
import Dashboard from "./pages/dashboard/Dashboard";

import UsersList from "./pages/users/Users";
import AddUser from "./pages/users/AddUser";

import NewPatient       from "./pages/opd/NewPatient";
import RegisteredPatient from "./pages/opd/RegisteredPatient";
import BookingPage       from "./pages/opd/BookingPage";
import SearchDoctor      from "./pages/opd/SearchDoctor";
import EPrescription     from "./pages/opd/EPrescription";
import AddDoctor         from "./pages/opd/AddDoctor";

import Accounts    from "./pages/accounts/Accounts";
import IpdList     from "./pages/ipd/IpdList";
import Pharmacy    from "./pages/pharmacy/Pharmacy";
import Operations  from "./pages/operations/Operations";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const RoleRoute = ({ children, allowed }: { children: React.ReactNode; allowed: string[] }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return allowed.includes(user.role.toLowerCase()) ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

const OpdGuard = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute allowed={["admin", "receptionist"]}>{children}</RoleRoute>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<HospitalLogin />} />

          <Route path="/" element={<ProtectedRoute><HospitalLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* OPD */}
            <Route path="opd" element={<Navigate to="/opd/new-patient" replace />} />
            <Route path="opd/new-patient"  element={<OpdGuard><NewPatient /></OpdGuard>} />
            <Route path="opd/registered"   element={<OpdGuard><RegisteredPatient /></OpdGuard>} />
            <Route path="opd/book/:patientId" element={<OpdGuard><BookingPage /></OpdGuard>} />
            <Route path="opd/search-doctor"   element={<OpdGuard><SearchDoctor /></OpdGuard>} />
            <Route path="opd/e-prescription" element={<OpdGuard><EPrescription /></OpdGuard>} />
            <Route path="opd/add-doctor"     element={<OpdGuard><AddDoctor /></OpdGuard>} />

            {/* IPD */}
            <Route path="ipd" element={<RoleRoute allowed={["admin","receptionist"]}><IpdList /></RoleRoute>} />

            {/* Pharmacy */}
            <Route path="pharmacy" element={<RoleRoute allowed={["admin","pharmacist","doctor","nurse"]}><Pharmacy /></RoleRoute>} />

            {/* Accounts */}
            <Route path="accounts" element={<RoleRoute allowed={["admin","accountant","labtech"]}><Accounts /></RoleRoute>} />

            {/* Operations */}
            <Route path="operations" element={<RoleRoute allowed={["admin","labtech"]}><Operations /></RoleRoute>} />

            {/* Users */}
            <Route path="users"     element={<RoleRoute allowed={["admin"]}><UsersList /></RoleRoute>} />
            <Route path="users/add" element={<RoleRoute allowed={["admin"]}><AddUser /></RoleRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
