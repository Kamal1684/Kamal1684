import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { FileText, Check, Building2 } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { APPLICATION_STEPS, appStatusMeta, fmtDate } from "../../lib/status";
import { AppStatusBadge } from "../../components/nurse/Badges";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";

function StatusTracker({ status }) {
  if (status === "rejected" || status === "withdrawn") {
    return (
      <p className="text-sm text-slate-500">
        This application was <span className={`font-semibold ${status === "rejected" ? "text-red-600" : "text-slate-700"}`}>{appStatusMeta(status).label.toLowerCase()}</span>.
      </p>
    );
  }
  const idx = APPLICATION_STEPS.findIndex((s) => s.key === status);
  const current = idx === -1 ? 0 : idx;
  return (
    <div className="flex items-center w-full overflow-x-auto pb-1" data-testid="application-status-tracker">
      {APPLICATION_STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 min-w-fit">
          <div className="flex flex-col items-center gap-1.5 min-w-fit">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              i < current ? "bg-blue-600 border-blue-600 text-white" :
              i === current ? "bg-blue-50 border-blue-600 text-blue-700" :
              "bg-white border-slate-200 text-slate-400"}`}>
              {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-[10px] sm:text-xs font-medium whitespace-nowrap ${i <= current ? "text-slate-800" : "text-slate-400"}`}>{step.label}</span>
          </div>
          {i < APPLICATION_STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1.5 sm:mx-2 min-w-4 mb-5 ${i < current ? "bg-blue-600" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Applications() {
  const [apps, setApps] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setApps(null);
    api.get("/application").then((r) => setApps(r.data || [])).catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!apps) return <LoadingState label="Loading your applications..." />;

  return (
    <div data-testid="applications-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Applications</h1>
        <p className="text-sm text-slate-500 mt-1">{apps.length} application{apps.length === 1 ? "" : "s"} submitted · status is managed by hospitals</p>
      </div>
      {apps.length === 0 ? (
        <EmptyState testId="applications-empty" icon={FileText} title="No applications yet" description="When you apply to a job, you'll be able to track its progress here."
          action={<Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700" data-testid="applications-find-cta"><Link to="/nurse/jobs">Find Jobs</Link></Button>} />
      ) : (
        <div className="space-y-4">
          {apps.map((a) => (
            <Card key={a.id} data-testid={`application-card-${a.id}`} className="border-slate-200">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-heading font-semibold text-slate-900">{a.job_title || "Job application"}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Building2 className="h-3.5 w-3.5" /> {a.hospital_name || "Hospital"}{a.department ? ` · ${a.department}` : ""}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Applied {fmtDate(a.created_at)}{a.updated_at ? ` · Last updated ${fmtDate(a.updated_at)}` : ""}
                    </p>
                  </div>
                  <AppStatusBadge status={a.status} testId={`application-status-${a.id}`} />
                </div>
                <StatusTracker status={a.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
