import { useEffect, useState, useCallback } from "react";
import { UserCheck, GraduationCap, Briefcase, Phone } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { fmtDate } from "../../lib/status";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

export default function Hired() {
  const [apps, setApps] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setApps(null);
    api.get("/application")
      .then((r) => setApps((r.data || []).filter((a) => a.status === "selected")))
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!apps) return <LoadingState label="Loading hired nurses..." />;

  return (
    <div data-testid="hired-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Hired Nurses</h1>
        <p className="text-sm text-slate-500 mt-1">{apps.length} nurse{apps.length === 1 ? "" : "s"} selected through NurseConnect</p>
      </div>
      {apps.length === 0 ? (
        <EmptyState testId="hired-empty" icon={UserCheck} title="No hires yet" description="Nurses you mark as Selected will appear in your hired roster." />
      ) : (
        <div className="space-y-4">
          {apps.map((a) => (
            <Card key={a.id} data-testid={`hired-card-${a.id}`} className="border-slate-200">
              <CardContent className="p-5 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <h3 className="font-heading font-semibold text-slate-900">{a.nurse_name || "Nurse"}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{a.job_title || "Job"}{a.department ? ` · ${a.department}` : ""}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-600 mt-2">
                    {a.nurse_qualification && <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-slate-400" /> {a.nurse_qualification}</span>}
                    {a.nurse_experience_years !== undefined && a.nurse_experience_years !== "" && a.nurse_experience_years !== null && <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-slate-400" /> {a.nurse_experience_years} yrs exp</span>}
                    {a.nurse_phone && <span data-testid={`hired-phone-${a.id}`} className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" /> {a.nurse_phone}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-medium">Selected</Badge>
                  <span className="text-xs text-slate-400">Selected {fmtDate(a.updated_at || a.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
