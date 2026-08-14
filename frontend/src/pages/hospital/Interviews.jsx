import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Video, MapPin, ExternalLink } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { fmtDate, INTERVIEW_STATUS_META } from "../../lib/status";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { ScheduleDialog } from "../../components/hospital/ScheduleDialog";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

export default function HospitalInterviews() {
  const [interviews, setInterviews] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [reschedule, setReschedule] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setInterviews(null);
    api.get("/interview").then((r) => setInterviews(r.data || [])).catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const setStatus = async (iv, status, label) => {
    setBusyId(iv.id);
    try {
      const { data } = await api.patch(`/interview/${iv.id}`, { status, updated_at: new Date().toISOString() });
      setInterviews((list) => list.map((x) => (x.id === iv.id ? data : x)));
      toast.success(label);
    } catch (e) {
      toast.error(apiError(e, "Could not update interview"));
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!interviews) return <LoadingState label="Loading interviews..." />;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = interviews.filter((i) => (i.date || "") >= today && i.status !== "cancelled" && i.status !== "completed");
  const past = interviews.filter((i) => !upcoming.includes(i));

  const renderCard = (iv) => {
    const meta = INTERVIEW_STATUS_META[iv.status] || INTERVIEW_STATUS_META.scheduled;
    const isVideo = String(iv.interview_type || "").toLowerCase().includes("video");
    return (
      <Card key={iv.id} data-testid={`hospital-interview-card-${iv.id}`} className="border-slate-200">
        <CardContent className="p-5 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-slate-900">{iv.nurse_name || "Candidate"}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{iv.job_title || "Job"}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 mt-2">
              <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-slate-400" /> {fmtDate(iv.date)}{iv.time ? ` · ${iv.time}` : ""}</span>
              {iv.interview_type && (
                <span className="flex items-center gap-1.5 capitalize">
                  {isVideo ? <Video className="h-3.5 w-3.5 text-slate-400" /> : <MapPin className="h-3.5 w-3.5 text-slate-400" />} {iv.interview_type}
                </span>
              )}
            </div>
            {iv.meeting_link && (
              <a data-testid={`hospital-interview-link-${iv.id}`} href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mt-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Meeting link
              </a>
            )}
            {iv.location && <p className="text-sm text-slate-600 mt-1.5">Location: {iv.location}</p>}
            {iv.notes && <p className="text-xs text-slate-500 mt-1.5 whitespace-pre-wrap">Notes: {iv.notes}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge data-testid={`interview-status-badge-${iv.id}`} variant="outline" className={meta.cls}>{meta.label}</Badge>
            {iv.status !== "cancelled" && iv.status !== "completed" && (
              <div className="flex gap-2 flex-wrap justify-end">
                <Button data-testid={`reschedule-interview-btn-${iv.id}`} variant="outline" size="sm" onClick={() => setReschedule(iv)}>Reschedule</Button>
                <Button data-testid={`complete-interview-btn-${iv.id}`} variant="outline" size="sm" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50" disabled={busyId === iv.id} onClick={() => setStatus(iv, "completed", "Interview marked completed")}>Mark Completed</Button>
                <Button data-testid={`cancel-interview-btn-${iv.id}`} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" disabled={busyId === iv.id} onClick={() => setStatus(iv, "cancelled", "Interview cancelled")}>Cancel</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div data-testid="hospital-interviews-page" className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Interviews</h1>
        <p className="text-sm text-slate-500 mt-1">Interviews for your hospital's job applications</p>
      </div>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-slate-800">Upcoming</h2>
        {upcoming.length === 0 ? (
          <EmptyState testId="hospital-upcoming-interviews-empty" icon={CalendarClock} title="No upcoming interviews"
            description="Schedule interviews with shortlisted candidates from the Candidates page."
            action={<Button asChild size="sm" variant="outline" data-testid="hospital-interviews-candidates-cta"><Link to="/hospital/candidates">Go to Candidates</Link></Button>} />
        ) : (
          upcoming.map(renderCard)
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-slate-800">Past &amp; Closed</h2>
        {past.length === 0 ? (
          <p data-testid="hospital-past-interviews-empty" className="text-sm text-slate-400">No past interviews.</p>
        ) : (
          past.map(renderCard)
        )}
      </section>

      <ScheduleDialog open={!!reschedule} onClose={() => setReschedule(null)} interview={reschedule} onDone={load} />
    </div>
  );
}
