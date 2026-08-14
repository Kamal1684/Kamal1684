import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Bookmark, FileText, Star, CalendarClock, UserRound, ArrowRight } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { profileCompletion } from "../../lib/match";
import { fmtDate } from "../../lib/status";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { VerificationBadge, AppStatusBadge } from "../../components/nurse/Badges";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { Button } from "../../components/ui/button";

const StatCard = ({ label, value, icon: Icon, testId, accent = "text-blue-600 bg-blue-50" }) => (
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

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    Promise.all([api.get("/nurse_profile"), api.get("/saved_job"), api.get("/application"), api.get("/interview")])
      .then(([np, sj, apps, iv]) => setData({ profile: np.data[0] || null, saved: sj.data || [], apps: apps.data || [], interviews: iv.data || [] }))
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading your dashboard..." />;

  const { profile, saved, apps, interviews } = data;
  const completion = profileCompletion(profile);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = interviews.filter((i) => (i.date || "") >= today);
  const active = apps.filter((a) => !["rejected", "withdrawn", "selected"].includes(a.status));
  const shortlisted = apps.filter((a) => a.status === "shortlisted");

  return (
    <div data-testid="nurse-dashboard" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Your job search at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard testId="stat-card-saved-jobs" label="Saved Jobs" value={saved.length} icon={Bookmark} />
        <StatCard testId="stat-card-active-applications" label="Active Applications" value={active.length} icon={FileText} accent="text-indigo-600 bg-indigo-50" />
        <StatCard testId="stat-card-shortlisted" label="Shortlisted" value={shortlisted.length} icon={Star} accent="text-emerald-600 bg-emerald-50" />
        <StatCard testId="stat-card-upcoming-interviews" label="Upcoming Interviews" value={upcoming.length} icon={CalendarClock} accent="text-cyan-600 bg-cyan-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card data-testid="profile-summary-card" className="border-slate-200 lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-lg">My Profile</CardTitle>
              <VerificationBadge status={profile?.verification_status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Profile completion</span>
                <span data-testid="profile-completion-value" className="font-semibold text-slate-800">{completion}%</span>
              </div>
              <Progress data-testid="profile-completion-progress" value={completion} className="h-2" />
            </div>
            {profile ? (
              <dl className="space-y-2.5 text-sm">
                {[
                  ["Full name", profile.full_name],
                  ["Qualification", profile.qualification],
                  ["Registration no.", profile.registration_number],
                  ["Experience", profile.experience_years !== undefined && profile.experience_years !== "" ? `${profile.experience_years} years` : null],
                  ["Departments", (profile.departments || []).join(", ") || null],
                  ["Location", [profile.city, profile.state].filter(Boolean).join(", ") || null],
                  ["Preferred shift", profile.preferred_shift],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-medium text-slate-800 text-right">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">You haven't created your professional profile yet.</p>
            )}
            <Button asChild data-testid="complete-profile-btn" className="w-full bg-blue-600 hover:bg-blue-700">
              <Link to="/nurse/profile"><UserRound className="h-4 w-4 mr-2" /> {profile ? "Complete Profile" : "Create Profile"}</Link>
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="font-heading text-lg">Recent Applications</CardTitle>
              <Button asChild variant="ghost" size="sm" data-testid="view-all-applications-btn">
                <Link to="/nurse/applications">View all <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {apps.length === 0 ? (
                <EmptyState testId="dashboard-applications-empty" icon={FileText} title="No applications yet" description="Browse open positions and apply to get started."
                  action={<Button asChild size="sm" variant="outline" data-testid="find-jobs-cta"><Link to="/nurse/jobs">Find Jobs</Link></Button>} />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {apps.slice(0, 4).map((a) => (
                    <li key={a.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{a.job_title || "Job application"}</p>
                        <p className="text-xs text-slate-500">{a.hospital_name || ""} · Applied {fmtDate(a.created_at)}</p>
                      </div>
                      <AppStatusBadge status={a.status} testId={`application-status-${a.id}`} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="font-heading text-lg">Upcoming Interviews</CardTitle>
              <Button asChild variant="ghost" size="sm" data-testid="view-all-interviews-btn">
                <Link to="/nurse/interviews">View all <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <EmptyState testId="dashboard-interviews-empty" icon={CalendarClock} title="No upcoming interviews" description="Interviews scheduled by hospitals will appear here." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcoming.slice(0, 3).map((i) => (
                    <li key={i.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{i.job_title || "Interview"}</p>
                        <p className="text-xs text-slate-500">{i.hospital_name || ""} · {fmtDate(i.date)}{i.time ? ` at ${i.time}` : ""}</p>
                      </div>
                      <span className="text-xs font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-full px-2.5 py-1 capitalize">{i.interview_type || i.type || "Interview"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
