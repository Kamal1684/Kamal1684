import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";
import api from "./lib/api";
import Login from "./pages/Login";
import NurseLayout from "./components/nurse/NurseLayout";
import Dashboard from "./pages/nurse/Dashboard";
import Profile from "./pages/nurse/Profile";
import Jobs from "./pages/nurse/Jobs";
import SavedJobs from "./pages/nurse/SavedJobs";
import Applications from "./pages/nurse/Applications";
import Interviews from "./pages/nurse/Interviews";
import { LoadingState } from "./components/nurse/States";

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
  if (user.account_type !== "nurse" && !user.is_admin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
        <h1 data-testid="not-a-nurse-message" className="font-heading text-xl font-bold text-slate-900 mb-2">Nurse access only</h1>
        <p className="text-sm text-slate-500">This area is for nurse accounts. Your account type is "{user.account_type}".</p>
      </div>
    );
  }
  return <NurseLayout nurseName={nurseName} />;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-50"><LoadingState label="Loading..." /></div>;
  if (user?.account_type === "nurse" || user?.is_admin) return <Navigate to="/nurse/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/nurse" element={<NurseArea />}>
            <Route index element={<Navigate to="/nurse/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="saved-jobs" element={<SavedJobs />} />
            <Route path="applications" element={<Applications />} />
            <Route path="interviews" element={<Interviews />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
