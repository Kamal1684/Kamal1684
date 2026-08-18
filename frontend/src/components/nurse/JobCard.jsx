import { Building2, MapPin, IndianRupee, Clock, Users, GraduationCap, Briefcase, CalendarClock } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { MatchBadge, VerifiedHospitalBadge } from "./Badges";
import { fmtDate, fmtSalary } from "../../lib/status";

export function JobMeta({ job }) {
  const items = [
    { icon: Briefcase, value: job.department },
    { icon: MapPin, value: job.location },
    { icon: IndianRupee, value: fmtSalary(job) },
    { icon: Clock, value: job.shift ? `${job.shift} shift` : null },
    { icon: GraduationCap, value: job.qualification_required },
    { icon: Users, value: job.openings ? `${job.openings} openings` : null },
    { icon: CalendarClock, value: job.application_deadline ? `Apply by ${fmtDate(job.application_deadline)}` : null },
  ].filter((i) => i.value);
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-600">
      {items.map((it, idx) => (
        <span key={idx} className="flex items-center gap-1.5">
          <it.icon className="h-3.5 w-3.5 text-slate-400" /> {it.value}
        </span>
      ))}
    </div>
  );
}

export function JobCard({ job, match, saved, applied, onView, onSave, onRemove, onApply, busy }) {
  return (
    <Card data-testid={`job-card-${job.id || job.job_id}`} className="border-slate-200 hover:shadow-md transition-shadow">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-slate-900 text-lg leading-tight">{job.title || "Untitled role"}</h3>
            <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Building2 className="h-3.5 w-3.5" /> {job.hospital_name || "Hospital"}
              {job.hospital_verified && <VerifiedHospitalBadge />}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <MatchBadge match={match} jobId={job.id || job.job_id} />
            {job.accommodation && <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">Accommodation</Badge>}
          </div>
        </div>
        <JobMeta job={job} />
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <span className="text-xs text-slate-400">Posted {fmtDate(job.created_at || job.posted_at)}</span>
          <div className="flex gap-2 flex-wrap">
            {onView && <Button data-testid={`view-job-btn-${job.id || job.job_id}`} variant="outline" size="sm" onClick={onView}>View Details</Button>}
            {onSave && (
              <Button data-testid={`save-job-btn-${job.id}`} variant="outline" size="sm" disabled={saved || busy} onClick={onSave}>
                {saved ? "Saved" : "Save Job"}
              </Button>
            )}
            {onRemove && <Button data-testid={`remove-saved-job-btn-${job.job_id || job.id}`} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" disabled={busy} onClick={onRemove}>Remove</Button>}
            {onApply && (
              <Button data-testid={`apply-job-btn-${job.id || job.job_id}`} size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={applied || busy} onClick={onApply}>
                {applied ? "Applied" : "Apply"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
