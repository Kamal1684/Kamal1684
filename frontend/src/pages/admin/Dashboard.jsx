import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { UserRound, Building2, Briefcase, FileText, ShieldCheck, Clock } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { jobState } from "../../lib/status";
import { LoadingState, ErrorState } from "../../components/nurse/States";
import { Card, CardContent } from "../../components/ui/card";

const PENDING = new Set(["pending", "under_review"]);

const StatCard = ({ label, value, icon: Icon, testId, accent = "text-indigo-600 bg-indigo-50", to }) => (
  <Card data-testid={testId} className="border-slate-200 hover:shadow-sm transition-shadow">
    <CardContent className="p-5">
      <Link to={to || "#"} className="flex items-center gap-4">
        <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-heading font-bold text-slate-900">{value}</p>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        </div>
      </Link>
    </CardContent>
  </Card>
);

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    Promise.all([api.get("/admin/users"), api.get("/nurse_profile"), api.get("/hospital"), api.get("/job"), api.get("/application")])
      .then(([u, np, h, j, a]) => setData({ users: u.data || [], nurses: np.data || [], hospitals: h.data || [], jobs: j.data || [], apps: a.data || [] }))
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading platform overview..." />;

  const { users, nurses, hospitals, jobs, apps } = data;
  const totalNurses = users.filter((u) => u.account_type === "nurse").length;
  const totalHospitals = users.filter((u) => u.account_type === "hospital").length;
  const verifiedNurses = nurses.filter((n) => n.verification_status === "verified").length;
  const pendingNurses = nurses.filter((n) => PENDING.has(n.verification_status || "pending")).length;
  const verifiedHospitals = hospitals.filter((h) => h.verification_status === "verified").length;
  const pendingHospitals = hospitals.filter((h) => PENDING.has(h.verification_status || "pending")).length;
  const pendingJobs = jobs.filter((j) => jobState(j) === "pending_approval").length;
  const activeJobs = jobs.filter((j) => jobState(j) === "published").length;

  const stats = [
    { testId: "stat-total-nurses", label: "Total Nurses", value: totalNurses, icon: UserRound, to: "/admin/nurses" },
    { testId: "stat-verified-nurses", label: "Verified Nurses", value: verifiedNurses, icon: ShieldCheck, accent: "text-emerald-600 bg-emerald-50", to: "/admin/nurses" },
    { testId: "stat-pending-nurses", label: "Pending Nurse Verification", value: pendingNurses, icon: Clock, accent: "text-amber-600 bg-amber-50", to: "/admin/verification" },
    { testId: "stat-total-hospitals", label: "Total Hospitals", value: totalHospitals, icon: Building2, to: "/admin/hospitals" },
    { testId: "stat-verified-hospitals", label: "Verified Hospitals", value: verifiedHospitals, icon: ShieldCheck, accent: "text-emerald-600 bg-emerald-50", to: "/admin/hospitals" },
    { testId: "stat-pending-hospitals", label: "Pending Hospital Verification", value: pendingHospitals, icon: Clock, accent: "text-amber-600 bg-amber-50", to: "/admin/verification" },
    { testId: "stat-total-jobs", label: "Total Jobs", value: jobs.length, icon: Briefcase, to: "/admin/jobs" },
    { testId: "stat-pending-jobs", label: "Pending Job Approvals", value: pendingJobs, icon: Clock, accent: "text-amber-600 bg-amber-50", to: "/admin/jobs" },
    { testId: "stat-active-jobs", label: "Active Jobs", value: activeJobs, icon: Briefcase, accent: "text-emerald-600 bg-emerald-50", to: "/admin/jobs" },
    { testId: "stat-total-applications", label: "Total Applications", value: apps.length, icon: FileText, to: "/admin/applications" },
  ];

  return (
    <div data-testid="admin-dashboard" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Platform overview — live data</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {stats.map((s) => <StatCard key={s.testId} {...s} />)}
      </div>
      {totalNurses === 0 && totalHospitals === 0 && (
        <Card className="border-dashed border-slate-200 bg-slate-50/60">
          <CardContent data-testid="admin-dashboard-empty" className="p-8 text-center text-sm text-slate-500">
            No platform activity yet. Stats will populate as nurses and hospitals register.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
