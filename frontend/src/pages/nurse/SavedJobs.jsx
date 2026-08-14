import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bookmark } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { computeMatch } from "../../lib/match";
import { JobCard } from "../../components/nurse/JobCard";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

export default function SavedJobs() {
  const [saved, setSaved] = useState(null);
  const [profile, setProfile] = useState(null);
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setError(null);
    setSaved(null);
    Promise.all([api.get("/saved_job"), api.get("/nurse_profile"), api.get("/application")])
      .then(([sj, np, apps]) => {
        setSaved(sj.data || []);
        setProfile(np.data[0] || null);
        setAppliedJobIds(new Set((apps.data || []).map((a) => a.job_id)));
      })
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const remove = async (item) => {
    setBusyId(item.id);
    try {
      await api.delete(`/saved_job/${item.id}`);
      setSaved((s) => s.filter((x) => x.id !== item.id));
      toast.success("Removed from saved jobs");
    } catch (e) {
      toast.error(apiError(e, "Could not remove"));
    } finally {
      setBusyId(null);
    }
  };

  const apply = async (item) => {
    setBusyId(item.id);
    try {
      await api.post("/application", { job_id: item.job_id, job_title: item.job_title, hospital_name: item.hospital_name, department: item.department });
      setAppliedJobIds((s) => new Set([...s, item.job_id]));
      toast.success("Application submitted");
    } catch (e) {
      if (e.response?.status === 409) {
        setAppliedJobIds((s) => new Set([...s, item.job_id]));
        toast.info("You have already applied to this job");
      } else {
        toast.error(apiError(e, "Could not apply"));
      }
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!saved) return <LoadingState label="Loading saved jobs..." />;

  return (
    <div data-testid="saved-jobs-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Saved Jobs</h1>
        <p className="text-sm text-slate-500 mt-1">{saved.length} job{saved.length === 1 ? "" : "s"} saved for later</p>
      </div>
      {saved.length === 0 ? (
        <EmptyState testId="saved-jobs-empty" icon={Bookmark} title="No saved jobs yet" description="Save interesting positions while browsing so you can come back to them."
          action={<Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700" data-testid="saved-jobs-find-cta"><Link to="/nurse/jobs">Find Jobs Now</Link></Button>} />
      ) : (
        <div className="space-y-4">
          {saved.map((item) => {
            const jobLike = { ...item, id: item.job_id, title: item.job_title, created_at: item.posted_at || item.created_at };
            return (
              <JobCard key={item.id} job={jobLike} match={computeMatch(profile, jobLike)}
                applied={appliedJobIds.has(item.job_id)} busy={busyId === item.id}
                onView={() => navigate("/nurse/jobs")} onRemove={() => remove(item)} onApply={() => apply(item)} />
            );
          })}
        </div>
      )}
    </div>
  );
}
