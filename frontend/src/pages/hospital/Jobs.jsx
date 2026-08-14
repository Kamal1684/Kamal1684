import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Briefcase, Plus, MapPin, IndianRupee, Clock, Users } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { fmtDate, fmtSalary, jobState, JOB_STATE_META } from "../../lib/status";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

export default function HospitalJobs() {
  const [jobs, setJobs] = useState(null);
  const [apps, setApps] = useState([]);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setError(null);
    setJobs(null);
    Promise.all([api.get("/job"), api.get("/application")])
      .then(([j, a]) => { setJobs(j.data || []); setApps(a.data || []); })
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const closeJob = async (job) => {
    setBusyId(job.id);
    try {
      const { data } = await api.patch(`/job/${job.id}`, { status: "closed", updated_at: new Date().toISOString() });
      setJobs((js) => js.map((x) => (x.id === job.id ? data : x)));
      toast.success("Job closed");
    } catch (e) {
      toast.error(apiError(e, "Could not close job"));
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!jobs) return <LoadingState label="Loading your jobs..." />;

  return (
    <div data-testid="hospital-jobs-page" className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Jobs</h1>
          <p className="text-sm text-slate-500 mt-1">{jobs.length} job{jobs.length === 1 ? "" : "s"} posted by your hospital</p>
        </div>
        <Button asChild data-testid="create-job-btn" className="bg-emerald-600 hover:bg-emerald-700">
          <Link to="/hospital/jobs/new"><Plus className="h-4 w-4 mr-2" /> Create Job</Link>
        </Button>
      </div>

      {jobs.length === 0 ? (
        <EmptyState testId="hospital-jobs-empty" icon={Briefcase} title="No jobs posted yet" description="Create your first job posting to start receiving applications from nurses."
          action={<Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700" data-testid="hospital-jobs-empty-cta"><Link to="/hospital/jobs/new">Create Job</Link></Button>} />
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const st = JOB_STATE_META[jobState(job)];
            const applicants = apps.filter((a) => a.job_id === job.id).length;
            return (
              <Card key={job.id} data-testid={`hospital-job-card-${job.id}`} className="border-slate-200">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="font-heading font-semibold text-slate-900 text-lg leading-tight">{job.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Posted {fmtDate(job.created_at)}{job.application_deadline ? ` · Apply by ${fmtDate(job.application_deadline)}` : ""}</p>
                    </div>
                    <Badge data-testid={`job-state-badge-${job.id}`} variant="outline" className={st.cls}>{st.label}</Badge>
                  </div>
                  {job.status === "rejected" && job.rejection_reason && (
                    <p data-testid={`job-rejection-reason-${job.id}`} className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                      Rejection reason: {job.rejection_reason}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-600">
                    {job.department && <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-slate-400" /> {job.department}</span>}
                    {job.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {job.location}</span>}
                    <span className="flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5 text-slate-400" /> {fmtSalary(job)}</span>
                    {job.shift && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-slate-400" /> {job.shift} shift</span>}
                    {job.openings && <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-slate-400" /> {job.openings} openings</span>}
                  </div>
                  <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                    <span data-testid={`job-applicant-count-${job.id}`} className="text-sm font-medium text-slate-700">
                      {applicants} applicant{applicants === 1 ? "" : "s"}
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      <Button data-testid={`view-applicants-btn-${job.id}`} variant="outline" size="sm" onClick={() => navigate(`/hospital/candidates?job=${job.id}`)}>View Applicants</Button>
                      <Button data-testid={`edit-job-btn-${job.id}`} variant="outline" size="sm" onClick={() => navigate(`/hospital/jobs/${job.id}/edit`)}>Edit</Button>
                      {jobState(job) !== "closed" && (
                        <Button data-testid={`close-job-btn-${job.id}`} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" disabled={busyId === job.id} onClick={() => closeJob(job)}>Close Job</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
