import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, GraduationCap, Briefcase, MapPin, CalendarClock } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { computeMatch, snapshotToNurse } from "../../lib/match";
import { fmtDate } from "../../lib/status";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { AppStatusBadge, VerificationBadge, MatchBadge } from "../../components/nurse/Badges";
import { ScheduleDialog } from "../../components/hospital/ScheduleDialog";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { toast } from "sonner";

export default function Candidates() {
  const [apps, setApps] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [scheduleFor, setScheduleFor] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const jobFilter = searchParams.get("job") || "all";

  const load = useCallback(() => {
    setError(null);
    setApps(null);
    Promise.all([api.get("/application"), api.get("/job")])
      .then(([a, j]) => { setApps(a.data || []); setJobs(j.data || []); })
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const jobById = useMemo(() => Object.fromEntries(jobs.map((j) => [j.id, j])), [jobs]);

  const rows = useMemo(() => {
    if (!apps) return [];
    return apps
      .filter((a) => jobFilter === "all" || a.job_id === jobFilter)
      .map((a) => ({ app: a, match: a.nurse_name ? computeMatch(snapshotToNurse(a), jobById[a.job_id] || {}) : null }))
      .sort((x, y) => (y.match?.score ?? -1) - (x.match?.score ?? -1));
  }, [apps, jobFilter, jobById]);

  const setStatus = async (app, status, label) => {
    setBusyId(app.id);
    try {
      const { data } = await api.patch(`/application/${app.id}`, { status, updated_at: new Date().toISOString() });
      setApps((as) => as.map((x) => (x.id === app.id ? data : x)));
      toast.success(label);
    } catch (e) {
      toast.error(apiError(e, "Could not update status"));
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!apps) return <LoadingState label="Loading candidates..." />;

  return (
    <div data-testid="candidates-page" className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Candidates</h1>
          <p className="text-sm text-slate-500 mt-1">Applicants for your hospital's jobs, sorted by match score</p>
        </div>
        <Select value={jobFilter} onValueChange={(v) => setSearchParams(v === "all" ? {} : { job: v })}>
          <SelectTrigger data-testid="candidates-job-filter" className="w-64"><SelectValue placeholder="Filter by job" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All jobs</SelectItem>
            {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState testId="candidates-empty" icon={Users} title="No applications yet"
          description={jobFilter === "all" ? "Once nurses apply to your published jobs, they will appear here." : "No applications for this job yet."} />
      ) : (
        <div className="space-y-4">
          {rows.map(({ app, match }) => (
            <Card key={app.id} data-testid={`candidate-card-${app.id}`} className="border-slate-200">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading font-semibold text-slate-900">{app.nurse_name || "Candidate"}</h3>
                      <VerificationBadge status={app.nurse_verification_status} testId={`candidate-verification-${app.id}`} />
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">Applied to <span className="font-medium text-slate-700">{app.job_title || jobById[app.job_id]?.title || "job"}</span> · {fmtDate(app.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <MatchBadge match={match} jobId={app.id} />
                    <AppStatusBadge status={app.status} testId={`application-status-${app.id}`} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-600">
                  {app.nurse_qualification && <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-slate-400" /> {app.nurse_qualification}</span>}
                  {app.nurse_experience_years !== undefined && app.nurse_experience_years !== "" && app.nurse_experience_years !== null && <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-slate-400" /> {app.nurse_experience_years} yrs exp</span>}
                  {(app.nurse_departments || []).length > 0 && <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-slate-400" /> {app.nurse_departments.join(", ")}</span>}
                  {app.nurse_location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {app.nurse_location}</span>}
                </div>
                <div className="flex justify-end gap-2 flex-wrap pt-1">
                  <Button data-testid={`view-candidate-btn-${app.id}`} variant="outline" size="sm" onClick={() => setDetail({ app, match })}>View Candidate</Button>
                  {!["shortlisted", "selected", "rejected", "withdrawn"].includes(app.status) && (
                    <Button data-testid={`shortlist-btn-${app.id}`} variant="outline" size="sm" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50" disabled={busyId === app.id} onClick={() => setStatus(app, "shortlisted", "Candidate shortlisted")}>Shortlist</Button>
                  )}
                  {["shortlisted", "interview_scheduled"].includes(app.status) && (
                    <Button data-testid={`select-btn-${app.id}`} size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={busyId === app.id} onClick={() => setStatus(app, "selected", "Candidate selected")}>Select</Button>
                  )}
                  {!["rejected", "selected", "withdrawn"].includes(app.status) && (
                    <Button data-testid={`reject-btn-${app.id}`} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" disabled={busyId === app.id} onClick={() => setStatus(app, "rejected", "Candidate rejected")}>Reject</Button>
                  )}
                  {["shortlisted", "under_review", "submitted"].includes(app.status) && (
                    <Button data-testid={`schedule-interview-btn-${app.id}`} variant="outline" size="sm" className="text-cyan-700 border-cyan-200 hover:bg-cyan-50" onClick={() => setScheduleFor(app)}>
                      <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> Schedule Interview
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent data-testid="candidate-details-dialog" className="max-w-md">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading">{detail.app.nurse_name || "Candidate"}</DialogTitle>
                <DialogDescription>Applied to {detail.app.job_title || "job"} on {fmtDate(detail.app.created_at)}</DialogDescription>
              </DialogHeader>
              <dl className="space-y-2.5 text-sm">
                {[
                  ["Qualification", detail.app.nurse_qualification],
                  ["Experience", detail.app.nurse_experience_years !== undefined && detail.app.nurse_experience_years !== "" ? `${detail.app.nurse_experience_years} years` : null],
                  ["Departments", (detail.app.nurse_departments || []).join(", ") || null],
                  ["Location", detail.app.nurse_location],
                  ["Preferred shift", detail.app.nurse_preferred_shift],
                  ["Expected salary", detail.app.nurse_expected_salary ? `₹${Number(detail.app.nurse_expected_salary).toLocaleString()}/month` : null],
                  ["Accommodation needed", detail.app.nurse_accommodation_required !== undefined ? (detail.app.nurse_accommodation_required ? "Yes" : "No") : null],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-medium text-slate-800 text-right">{v}</dd>
                  </div>
                ))}
              </dl>
              {detail.match && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-sm font-semibold text-slate-800 mb-2">{detail.match.score}% match (rule-based)</p>
                  <ul className="space-y-1 text-sm text-slate-600">
                    {detail.match.breakdown.map((c) => (
                      <li key={c.label} className="flex justify-between">
                        <span>{c.label}</span>
                        <span className={c.matched ? "text-emerald-600 font-medium" : "text-slate-400"}>{c.matched ? "Match" : "No match"} · {c.weight}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!detail.app.nurse_name && <p className="text-sm text-slate-500">This application does not include a profile snapshot.</p>}
            </>
          )}
        </DialogContent>
      </Dialog>

      <ScheduleDialog open={!!scheduleFor} onClose={() => setScheduleFor(null)} application={scheduleFor} onDone={load} />
    </div>
  );
}
