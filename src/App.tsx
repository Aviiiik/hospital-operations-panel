import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HospitalLogin from './pages/auth/Login';
import HospitalLayout from './components/layout/HospitalLayout';
import Dashboard from './pages/dashboard/Dashboard';
// We'll add more pages later

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<HospitalLogin />} />
        
        {/* Protected Routes */}
        <Route path="/" element={<HospitalLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          {/* Users, Accounts, etc. will be added here */}
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;