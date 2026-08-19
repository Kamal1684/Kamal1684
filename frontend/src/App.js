import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";
import api from "./lib/api";
import Login from "./pages/Login";
import { ForgotPassword, ResetPassword } from "./pages/PasswordReset";
import NurseLayout from "./components/nurse/NurseLayout";
import Dashboard from "./pages/nurse/Dashboard";
import Profile from "./pages/nurse/Profile";
import Jobs from "./pages/nurse/Jobs";
import SavedJobs from "./pages/nurse/SavedJobs";
import Applications from "./pages/nurse/Applications";
import Interviews from "./pages/nurse/Interviews";
import HospitalLayout from "./components/hospital/HospitalLayout";
import HospitalDashboard from "./pages/hospital/Dashboard";
import HospitalProfile from "./pages/hospital/Profile";
import HospitalJobs from "./pages/hospital/Jobs";
import JobForm from "./pages/hospital/JobForm";
import Candidates from "./pages/hospital/Candidates";
import HospitalInterviews from "./pages/hospital/Interviews";
import Hired from "./pages/hospital/Hired";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminNurses from "./pages/admin/Nurses";
import AdminHospitals from "./pages/admin/Hospitals";
import AdminJobs from "./pages/admin/Jobs";
import AdminApplications from "./pages/admin/Applications";
import Verification from "./pages/admin/Verification";
import AdminReports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/Settings";
import { LoadingState } from "./components/nurse/States";

const AccessDenied = ({ area, user }) => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
    <h1 data-testid={`not-a-${area}-message`} className="font-heading text-xl font-bold text-slate-900 mb-2">
      {area === "nurse" ? "Nurse access only" : "Hospital access only"}
    </h1>
    <p className="text-sm text-slate-500">This area is for {area} accounts. Your account type is "{user.account_type}".</p>
  </div>
);

function NurseArea() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [nurseName, setNurseName] = useState("");

  useEffect(() => {
    if (user && (user.account_type === "nurse" || user.is_admin)) {
      api.get("/nurse_profile").then((r) => setNurseName(r.data[0]?.full_name || "")).catch(() => {});
    }
  }, [user, location.pathname]);

  if (loading) return <div className="min-h-screen bg-slate-50"><LoadingState label="Checking your session..." /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.account_type !== "nurse" && !user.is_admin) return <AccessDenied area="nurse" user={user} />;
  return <NurseLayout nurseName={nurseName} />;
}

function HospitalArea() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [hospital, setHospital] = useState(null);

  const refresh = useCallback(() => {
    api.get("/hospital").then((r) => setHospital(r.data[0] || null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user && (user.account_type === "hospital" || user.is_admin)) refresh();
  }, [user, location.pathname, refresh]);

  if (loading) return <div className="min-h-screen bg-slate-50"><LoadingState label="Checking your session..." /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.account_type !== "hospital" && !user.is_admin) return <AccessDenied area="hospital" user={user} />;
  return <HospitalLayout hospital={hospital} onRefresh={refresh} />;
}

function AdminArea() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-50"><LoadingState label="Checking your session..." /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
        <h1 data-testid="not-an-admin-message" className="font-heading text-xl font-bold text-slate-900 mb-2">Admin access only</h1>
        <p className="text-sm text-slate-500">Your account does not have administrator privileges.</p>
      </div>
    );
  }
  return <AdminLayout />;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-50"><LoadingState label="Loading..." /></div>;
  if (user?.is_admin) return <Navigate to="/admin/dashboard" replace />;
  if (user?.account_type === "nurse") return <Navigate to="/nurse/dashboard" replace />;
  if (user?.account_type === "hospital") return <Navigate to="/hospital/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/nurse" element={<NurseArea />}>
            <Route index element={<Navigate to="/nurse/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="saved-jobs" element={<SavedJobs />} />
            <Route path="applications" element={<Applications />} />
            <Route path="interviews" element={<Interviews />} />
          </Route>
          <Route path="/hospital" element={<HospitalArea />}>
            <Route index element={<Navigate to="/hospital/dashboard" replace />} />
            <Route path="dashboard" element={<HospitalDashboard />} />
            <Route path="profile" element={<HospitalProfile />} />
            <Route path="jobs" element={<HospitalJobs />} />
            <Route path="jobs/new" element={<JobForm />} />
            <Route path="jobs/:jobId/edit" element={<JobForm />} />
            <Route path="candidates" element={<Candidates />} />
            <Route path="interviews" element={<HospitalInterviews />} />
            <Route path="hired" element={<Hired />} />
          </Route>
          <Route path="/admin" element={<AdminArea />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="nurses" element={<AdminNurses />} />
            <Route path="hospitals" element={<AdminHospitals />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="applications" element={<AdminApplications />} />
            <Route path="verification" element={<Verification />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
