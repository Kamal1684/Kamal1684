import { useEffect, useMemo, useState, useCallback } from "react";
import { FileText } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { fmtDate } from "../../lib/status";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { AppStatusBadge } from "../../components/nurse/Badges";
import { Card, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

const STATUSES = ["submitted", "under_review", "shortlisted", "interview_scheduled", "selected", "rejected", "withdrawn"];

export default function AdminApplications() {
  const [apps, setApps] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ status: "all", hospital: "", job: "" });

  const load = useCallback(() => {
    setError(null);
    setApps(null);
    api.get("/application").then((r) => setApps(r.data || [])).catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const filtered = useMemo(() => {
    if (!apps) return [];
    const has = (v, n) => String(v || "").toLowerCase().includes(n.toLowerCase());
    return apps.filter((a) => {
      if (filters.status !== "all" && (a.status || "submitted") !== filters.status) return false;
      if (filters.hospital && !has(a.hospital_name, filters.hospital)) return false;
      if (filters.job && !has(a.job_title, filters.job)) return false;
      return true;
    });
  }, [apps, filters]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!apps) return <LoadingState label="Loading applications..." />;

  return (
    <div data-testid="admin-applications-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Applications</h1>
        <p className="text-sm text-slate-500 mt-1">{apps.length} application{apps.length === 1 ? "" : "s"} · read-only administrative view</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger data-testid="application-filter-status" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input data-testid="application-filter-hospital" className="w-48" placeholder="Hospital" value={filters.hospital} onChange={(e) => setFilters({ ...filters, hospital: e.target.value })} />
        <Input data-testid="application-filter-job" className="w-48" placeholder="Job title" value={filters.job} onChange={(e) => setFilters({ ...filters, job: e.target.value })} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState testId="admin-applications-empty" icon={FileText} title={apps.length === 0 ? "No applications yet" : "No applications match your filters"}
          description={apps.length === 0 ? "Applications submitted by nurses will appear here." : "Try adjusting the filters."} />
      ) : (
        <Card className="border-slate-200">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Nurse", "Hospital", "Job", "Applied", "Status", "Last Updated"].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id} data-testid={`admin-application-row-${a.id}`}>
                    <TableCell className="font-medium text-slate-800 whitespace-nowrap">{a.nurse_name || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{a.hospital_name || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{a.job_title || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(a.created_at)}</TableCell>
                    <TableCell><AppStatusBadge status={a.status} testId={`admin-app-status-${a.id}`} /></TableCell>
                    <TableCell className="whitespace-nowrap">{a.updated_at ? fmtDate(a.updated_at) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
