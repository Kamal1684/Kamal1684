import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { FileText, Check, Building2, PartyPopper } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { APPLICATION_STEPS, appStatusMeta, fmtDate } from "../../lib/status";
import { AppStatusBadge } from "../../components/nurse/Badges";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { toast } from "sonner";

function StatusTracker({ status }) {
  if (status === "rejected" || status === "withdrawn") {
    return (
      <p className="text-sm text-slate-500">
        This application was <span className={`font-semibold ${status === "rejected" ? "text-red-600" : "text-slate-700"}`}>{appStatusMeta(status).label.toLowerCase()}</span>.
      </p>
    );
  }
  const effective = status === "joined" ? "selected" : status;
  const idx = APPLICATION_STEPS.findIndex((s) => s.key === effective);
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
  const [busyId, setBusyId] = useState(null);
  const [congrats, setCongrats] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setApps(null);
    api.get("/application").then((r) => {
      const list = r.data || [];
      setApps(list);
      const won = list.find((a) => ["selected", "joined"].includes(a.status) && localStorage.getItem(`nc_congrats_${a.id}`) !== "1");
      if (won) setCongrats(won);
    }).catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const withdraw = async (a) => {
    setBusyId(a.id);
    try {
      const { data } = await api.patch(`/application/${a.id}`, { status: "withdrawn", updated_at: new Date().toISOString() });
      setApps((list) => list.map((x) => (x.id === a.id ? data : x)));
      toast.success("Application withdrawn");
    } catch (e) {
      toast.error(apiError(e, "Could not withdraw application"));
    } finally {
      setBusyId(null);
    }
  };

  const dismissCongrats = () => {
    if (congrats) localStorage.setItem(`nc_congrats_${congrats.id}`, "1");
    setCongrats(null);
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!apps) return <LoadingState label="Loading your applications..." />;

  const WITHDRAWABLE = new Set(["submitted", "under_review", "shortlisted", "interview_scheduled", "interview_completed"]);

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
                    {["selected", "joined"].includes(a.status) && a.joining_date && (
                      <p data-testid={`joining-date-${a.id}`} className="text-xs font-medium text-emerald-700 mt-1">Joining date: {fmtDate(a.joining_date)}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <AppStatusBadge status={a.status} testId={`application-status-${a.id}`} />
                    {WITHDRAWABLE.has(a.status) && (
                      <Button data-testid={`withdraw-application-btn-${a.id}`} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" disabled={busyId === a.id} onClick={() => withdraw(a)}>Withdraw</Button>
                    )}
                  </div>
                </div>
                <StatusTracker status={a.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!congrats} onOpenChange={(o) => !o && dismissCongrats()}>
        <DialogContent data-testid="congratulations-dialog" className="max-w-sm text-center">
          <DialogHeader>
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
              <PartyPopper className="h-7 w-7 text-emerald-600" />
            </div>
            <DialogTitle className="font-heading text-xl">Congratulations!</DialogTitle>
            <DialogDescription>
              You have been selected{congrats?.job_title ? ` for ${congrats.job_title}` : ""} at <span className="font-semibold text-slate-800">{congrats?.hospital_name || "the hospital"}</span>.
            </DialogDescription>
          </DialogHeader>
          {congrats?.joining_date && (
            <p data-testid="congrats-joining-date" className="text-sm text-slate-700">Your joining date is <span className="font-semibold text-emerald-700">{fmtDate(congrats.joining_date)}</span>.</p>
          )}
          <Button data-testid="congrats-dismiss-btn" className="bg-emerald-600 hover:bg-emerald-700 mt-2" onClick={dismissCongrats}>Great, thanks!</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
