import { useEffect, useMemo, useState, useCallback } from "react";
import { SearchX, Building2 } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { computeMatch, nurseSnapshot } from "../../lib/match";
import { fmtSalary } from "../../lib/status";
import { JobCard, JobMeta } from "../../components/nurse/JobCard";
import { VerifiedHospitalBadge } from "../../components/nurse/Badges";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { toast } from "sonner";

const initialFilters = { q: "", department: "", qualification: "", location: "", minSalary: "", maxExperience: "", shift: "", accommodation: false };

const snapshotFields = (job) => ({
  job_title: job.title, hospital_name: job.hospital_name, hospital_verified: !!job.hospital_verified,
  department: job.department, location: job.location, salary_min: job.salary_min, salary_max: job.salary_max,
  shift: job.shift, posted_at: job.created_at,
});

export default function Jobs() {
  const [jobs, setJobs] = useState(null);
  const [profile, setProfile] = useState(null);
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());
  const [savedJobIds, setSavedJobIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [detailJob, setDetailJob] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setJobs(null);
    Promise.all([api.get("/public/jobs"), api.get("/nurse_profile"), api.get("/application"), api.get("/saved_job")])
      .then(([j, np, apps, sj]) => {
        setJobs(j.data || []);
        setProfile(np.data[0] || null);
        setAppliedJobIds(new Set((apps.data || []).map((a) => a.job_id)));
        setSavedJobIds(new Set((sj.data || []).map((s) => s.job_id)));
      })
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const f = filters;
    const has = (v, needle) => String(v || "").toLowerCase().includes(needle.toLowerCase());
    return jobs.filter((j) => {
      if (f.q && !(has(j.title, f.q) || has(j.hospital_name, f.q) || has(j.department, f.q))) return false;
      if (f.department && !has(j.department, f.department)) return false;
      if (f.qualification && !has(j.qualification_required, f.qualification)) return false;
      if (f.location && !has(j.location, f.location)) return false;
      if (f.minSalary && Number(j.salary_max || j.salary_min || 0) < Number(f.minSalary)) return false;
      if (f.maxExperience !== "" && j.experience_required !== undefined && j.experience_required !== null && Number(j.experience_required) > Number(f.maxExperience)) return false;
      if (f.shift && !has(j.shift, f.shift)) return false;
      if (f.accommodation && !j.accommodation) return false;
      return true;
    });
  }, [jobs, filters]);

  const saveJob = async (job) => {
    setBusyId(job.id);
    try {
      await api.post("/saved_job", { job_id: job.id, ...snapshotFields(job) });
      setSavedJobIds((s) => new Set([...s, job.id]));
      toast.success("Job saved");
    } catch (e) {
      toast.error(apiError(e, "Could not save job"));
    } finally {
      setBusyId(null);
    }
  };

  const applyJob = async (job) => {
    setBusyId(job.id);
    try {
      await api.post("/application", { job_id: job.id, ...snapshotFields(job), ...nurseSnapshot(profile) });
      setAppliedJobIds((s) => new Set([...s, job.id]));
      toast.success("Application submitted");
    } catch (e) {
      if (e.response?.status === 409) {
        setAppliedJobIds((s) => new Set([...s, job.id]));
        toast.info("You have already applied to this job");
      } else {
        toast.error(apiError(e, "Could not apply"));
      }
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!jobs) return <LoadingState label="Loading open positions..." />;

  return (
    <div data-testid="find-jobs-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Find Jobs</h1>
        <p className="text-sm text-slate-500 mt-1">{jobs.length} published position{jobs.length === 1 ? "" : "s"} available</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <Card className="border-slate-200 lg:sticky lg:top-20">
          <CardHeader className="pb-3"><CardTitle className="font-heading text-base">Filters</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: "q", label: "Job title / keyword", placeholder: "e.g. ICU Nurse" },
              { key: "department", label: "Department", placeholder: "e.g. ICU" },
              { key: "qualification", label: "Qualification", placeholder: "e.g. BSc Nursing" },
              { key: "location", label: "Location", placeholder: "e.g. Mumbai" },
              { key: "minSalary", label: "Min salary (₹)", placeholder: "e.g. 30000", type: "number" },
              { key: "maxExperience", label: "My experience (years)", placeholder: "e.g. 3", type: "number" },
              { key: "shift", label: "Shift", placeholder: "e.g. Day / Night" },
            ].map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs text-slate-500">{f.label}</Label>
                <Input data-testid={`job-filter-${f.key}-input`} type={f.type || "text"} placeholder={f.placeholder} value={filters[f.key]}
                  onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })} className="h-9" />
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <Label className="text-xs text-slate-500">Accommodation provided</Label>
              <Switch data-testid="job-filter-accommodation-switch" checked={filters.accommodation} onCheckedChange={(v) => setFilters({ ...filters, accommodation: v })} />
            </div>
            <Button data-testid="job-filter-reset-btn" variant="outline" size="sm" className="w-full" onClick={() => setFilters(initialFilters)}>Reset filters</Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {filtered.length === 0 ? (
            <EmptyState testId="jobs-empty-state" icon={SearchX} title={jobs.length === 0 ? "No published jobs yet" : "No jobs match your filters"}
              description={jobs.length === 0 ? "Hospitals haven't published any active jobs yet. Check back soon." : "Try broadening your search filters."}
              action={jobs.length > 0 && <Button variant="outline" size="sm" onClick={() => setFilters(initialFilters)}>Clear filters</Button>} />
          ) : (
            filtered.map((job) => (
              <JobCard key={job.id} job={job} match={computeMatch(profile, job)}
                saved={savedJobIds.has(job.id)} applied={appliedJobIds.has(job.id)} busy={busyId === job.id}
                onView={() => setDetailJob(job)} onSave={() => saveJob(job)} onApply={() => applyJob(job)} />
            ))
          )}
        </div>
      </div>

      <Dialog open={!!detailJob} onOpenChange={(o) => !o && setDetailJob(null)}>
        <DialogContent data-testid="job-details-dialog" className="max-w-lg">
          {detailJob && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading">{detailJob.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 flex-wrap">
                  <Building2 className="h-4 w-4" /> {detailJob.hospital_name || "Hospital"}
                  {detailJob.hospital_verified && <VerifiedHospitalBadge />}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <JobMeta job={detailJob} />
                <p className="text-sm text-slate-600"><span className="font-medium text-slate-800">Salary:</span> {fmtSalary(detailJob)}</p>
                {detailJob.experience_required !== undefined && detailJob.experience_required !== null && detailJob.experience_required !== "" && (
                  <p className="text-sm text-slate-600"><span className="font-medium text-slate-800">Experience required:</span> {detailJob.experience_required} years</p>
                )}
                {detailJob.description && <p className="text-sm text-slate-600 whitespace-pre-wrap">{detailJob.description}</p>}
                <div className="flex gap-2 pt-2">
                  <Button data-testid="dialog-save-job-btn" variant="outline" disabled={savedJobIds.has(detailJob.id)} onClick={() => saveJob(detailJob)}>
                    {savedJobIds.has(detailJob.id) ? "Saved" : "Save Job"}
                  </Button>
                  <Button data-testid="dialog-apply-job-btn" className="bg-blue-600 hover:bg-blue-700" disabled={appliedJobIds.has(detailJob.id)} onClick={() => applyJob(detailJob)}>
                    {appliedJobIds.has(detailJob.id) ? "Applied" : "Apply Now"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
