import { useEffect, useState, useCallback } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Briefcase, FileText, Star, CalendarClock, UserCheck, Plus, ArrowRight } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { fmtDate, jobState, JOB_STATE_META } from "../../lib/status";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { VerificationBadge, AppStatusBadge } from "../../components/nurse/Badges";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";

const StatCard = ({ label, value, icon: Icon, testId, accent = "text-emerald-600 bg-emerald-50" }) => (
  <Card data-testid={testId} className="border-slate-200">
    <CardContent className="p-5 flex items-center gap-4">
      <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-heading font-bold text-slate-900">{value}</p>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
    </CardContent>
  </Card>
);

export default function HospitalDashboard() {
  const { hospital } = useOutletContext();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    Promise.all([api.get("/job"), api.get("/application"), api.get("/interview")])
      .then(([j, a, i]) => setData({ jobs: j.data || [], apps: a.data || [], interviews: i.data || [] }))
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading hospital dashboard..." />;

  const { jobs, apps, interviews } = data;
  const today = new Date().toISOString().slice(0, 10);
  const activeJobs = jobs.filter((j) => jobState(j) === "published");
  const shortlisted = apps.filter((a) => a.status === "shortlisted");
  const hired = apps.filter((a) => a.status === "selected");
  const upcoming = interviews.filter((i) => (i.date || "") >= today && i.status !== "cancelled");

  return (
    <div data-testid="hospital-dashboard" className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">{hospital?.name || "Your hospital"} · recruitment at a glance</p>
        </div>
        <Button asChild data-testid="dashboard-post-job-btn" className="bg-emerald-600 hover:bg-emerald-700">
          <Link to="/hospital/jobs/new"><Plus className="h-4 w-4 mr-2" /> Post a Job</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard testId="stat-card-active-jobs" label="Active Jobs" value={activeJobs.length} icon={Briefcase} />
        <StatCard testId="stat-card-total-applications" label="Applications" value={apps.length} icon={FileText} accent="text-blue-600 bg-blue-50" />
        <StatCard testId="stat-card-shortlisted-candidates" label="Shortlisted" value={shortlisted.length} icon={Star} accent="text-indigo-600 bg-indigo-50" />
        <StatCard testId="stat-card-upcoming-interviews" label="Upcoming Interviews" value={upcoming.length} icon={CalendarClock} accent="text-cyan-600 bg-cyan-50" />
        <StatCard testId="stat-card-hired-nurses" label="Hired Nurses" value={hired.length} icon={UserCheck} accent="text-emerald-600 bg-emerald-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="font-heading text-lg">Your Jobs</CardTitle>
            <Button asChild variant="ghost" size="sm" data-testid="view-all-jobs-btn">
              <Link to="/hospital/jobs">View all <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <EmptyState testId="dashboard-jobs-empty" icon={Briefcase} title="No jobs posted yet" description="Post your first job to start receiving applications."
                action={<Button asChild size="sm" variant="outline" data-testid="dashboard-jobs-empty-cta"><Link to="/hospital/jobs/new">Post a Job</Link></Button>} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {jobs.slice(0, 5).map((j) => {
                  const st = JOB_STATE_META[jobState(j)];
                  return (
                    <li key={j.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{j.title}</p>
                        <p className="text-xs text-slate-500">{j.department || "—"} · {j.location || "—"}</p>
                      </div>
                      <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="font-heading text-lg">Recent Applications</CardTitle>
            <Button asChild variant="ghost" size="sm" data-testid="view-all-candidates-btn">
              <Link to="/hospital/candidates">View all <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {apps.length === 0 ? (
              <EmptyState testId="dashboard-candidates-empty" icon={FileText} title="No applications yet" description="Applications from nurses will appear here once your jobs are published." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {apps.slice(0, 5).map((a) => (
                  <li key={a.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{a.nurse_name || "Candidate"}</p>
                      <p className="text-xs text-slate-500">{a.job_title || "Job"} · Applied {fmtDate(a.created_at)}</p>
                    </div>
                    <AppStatusBadge status={a.status} testId={`hospital-app-status-${a.id}`} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-heading font-semibold text-slate-900">Hospital verification</p>
            <p className="text-sm text-slate-500">Verified hospitals earn a trust badge on every job posting.</p>
          </div>
          <div className="flex items-center gap-3">
            <VerificationBadge status={hospital?.verification_status} testId="dashboard-hospital-verification-badge" />
            <Button asChild variant="outline" size="sm" data-testid="dashboard-hospital-profile-btn">
              <Link to="/hospital/profile">Manage Profile</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
