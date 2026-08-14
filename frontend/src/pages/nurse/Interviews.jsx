import { useEffect, useState, useCallback } from "react";
import { CalendarClock, Building2, MapPin, Video, ExternalLink } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { fmtDate } from "../../lib/status";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";

function InterviewCard({ iv, onOpen, past }) {
  const type = iv.interview_type || iv.type;
  return (
    <Card data-testid={`interview-card-${iv.id}`} className={`border-slate-200 ${past ? "opacity-75" : ""}`}>
      <CardContent className="p-5 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-heading font-semibold text-slate-900">{iv.job_title || "Interview"}</h3>
          <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
            <Building2 className="h-3.5 w-3.5" /> {iv.hospital_name || "Hospital"}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 mt-2">
            <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-slate-400" /> {fmtDate(iv.date)}{iv.time ? ` · ${iv.time}` : ""}</span>
            {type && <span className="flex items-center gap-1.5 capitalize">{String(type).toLowerCase().includes("video") || String(type).toLowerCase().includes("online") ? <Video className="h-3.5 w-3.5 text-slate-400" /> : <MapPin className="h-3.5 w-3.5 text-slate-400" />} {type}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {iv.status && <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 capitalize">{iv.status}</Badge>}
          <Button data-testid={`interview-details-btn-${iv.id}`} variant="outline" size="sm" onClick={onOpen}>View Details</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Interviews() {
  const [interviews, setInterviews] = useState(null);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setInterviews(null);
    api.get("/interview").then((r) => setInterviews(r.data || [])).catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!interviews) return <LoadingState label="Loading your interviews..." />;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = interviews.filter((i) => (i.date || "") >= today);
  const previous = interviews.filter((i) => (i.date || "") < today);
  const detailType = detail && (detail.interview_type || detail.type);

  return (
    <div data-testid="interviews-page" className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Interviews</h1>
        <p className="text-sm text-slate-500 mt-1">Interviews scheduled for you by hospitals</p>
      </div>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-slate-800">Upcoming Interviews</h2>
        {upcoming.length === 0 ? (
          <EmptyState testId="upcoming-interviews-empty" icon={CalendarClock} title="No upcoming interviews" description="When a hospital schedules an interview for one of your applications, it will appear here." />
        ) : (
          upcoming.map((iv) => <InterviewCard key={iv.id} iv={iv} onOpen={() => setDetail(iv)} />)
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-slate-800">Previous Interviews</h2>
        {previous.length === 0 ? (
          <p data-testid="previous-interviews-empty" className="text-sm text-slate-400">No previous interviews.</p>
        ) : (
          previous.map((iv) => <InterviewCard key={iv.id} iv={iv} past onOpen={() => setDetail(iv)} />)
        )}
      </section>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent data-testid="interview-details-dialog" className="max-w-md">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading">{detail.job_title || "Interview details"}</DialogTitle>
                <DialogDescription>{detail.hospital_name || "Hospital"}</DialogDescription>
              </DialogHeader>
              <dl className="space-y-2.5 text-sm">
                {[
                  ["Date", fmtDate(detail.date)],
                  ["Time", detail.time],
                  ["Type", detailType],
                  ["Location", detail.location],
                  ["Status", detail.status],
                  ["Notes", detail.notes],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-medium text-slate-800 text-right capitalize whitespace-pre-wrap">{v}</dd>
                  </div>
                ))}
              </dl>
              {detail.meeting_link && (
                <Button asChild data-testid="interview-meeting-link-btn" className="bg-blue-600 hover:bg-blue-700 w-full">
                  <a href={detail.meeting_link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" /> Join Meeting</a>
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
