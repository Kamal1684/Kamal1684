import { useEffect, useMemo, useState, useCallback } from "react";
import { ClipboardList } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { fmtDate, appStatusMeta } from "../../lib/status";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { Card, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { AppStatusBadge } from "../../components/nurse/Badges";

export default function AdminReports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ status: "all", from: "", to: "", search: "" });

  const load = useCallback(() => {
    setError(null);
    setData(null);
    Promise.all([api.get("/application"), api.get("/job"), api.get("/hospital"), api.get("/nurse_profile"), api.get("/admin/users")])
      .then(([a, j, h, np, u]) => {
        const jobById = Object.fromEntries((j.data || []).map((x) => [x.id, x]));
        const hospById = Object.fromEntries((h.data || []).map((x) => [x.id, x]));
        const hospByOwner = Object.fromEntries((h.data || []).map((x) => [x.owner_id, x]));
        const nurseByOwner = Object.fromEntries((np.data || []).map((x) => [x.owner_id, x]));
        const emailById = Object.fromEntries((u.data || []).map((x) => [x.id, x.email]));
        const rows = (a.data || [])
          .filter((app) => ["selected", "joined"].includes(app.status))
          .map((app) => {
            const job = jobById[app.job_id] || {};
            const hosp = hospById[job.hospital_id] || hospByOwner[job.hospital_id] || {};
            const nurse = nurseByOwner[app.nurse_id] || {};
            const addr = [hosp.address, hosp.city, hosp.state, hosp.pincode].filter(Boolean).join(", ");
            return {
              id: app.id,
              nurse_name: app.nurse_name || nurse.full_name || emailById[app.nurse_id] || "—",
              hospital_name: app.hospital_name || hosp.name || "—",
              hospital_address: addr || "—",
              joining_date: app.joining_date || "",
              status: app.status,
            };
          });
        setData(rows);
      })
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const has = (v, q) => String(v || "").toLowerCase().includes(q.toLowerCase());
    return data.filter((r) => {
      if (filters.status !== "all" && r.status !== filters.status) return false;
      if (filters.from && (!r.joining_date || r.joining_date.slice(0, 10) < filters.from)) return false;
      if (filters.to && (!r.joining_date || r.joining_date.slice(0, 10) > filters.to)) return false;
      if (filters.search && !(has(r.nurse_name, filters.search) || has(r.hospital_name, filters.search) || has(r.hospital_address, filters.search))) return false;
      return true;
    });
  }, [data, filters]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading selected / joined report..." />;

  return (
    <div data-testid="admin-reports-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Selected / Joined Nurses</h1>
        <p className="text-sm text-slate-500 mt-1">{filtered.length} record{filtered.length === 1 ? "" : "s"} · live data</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Status</label>
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger data-testid="report-filter-status" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Selected + Joined</SelectItem>
              <SelectItem value="selected">Selected</SelectItem>
              <SelectItem value="joined">Joined</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Joining from</label>
          <Input data-testid="report-filter-from" type="date" className="w-44" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Joining to</label>
          <Input data-testid="report-filter-to" type="date" className="w-44" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Search</label>
          <Input data-testid="report-filter-search" className="w-56" placeholder="Nurse, hospital, address" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState testId="admin-reports-empty" icon={ClipboardList} title="No selected or joined nurses" description="Selected and joined candidates will appear here as hospitals finalise hires." />
      ) : (
        <Card className="border-slate-200">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Nurse Name", "Hospital Name", "Hospital Address", "Joining Date", "Status"].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} data-testid={`report-row-${r.id}`}>
                    <TableCell className="font-medium text-slate-800 whitespace-nowrap">{r.nurse_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.hospital_name}</TableCell>
                    <TableCell className="max-w-xs">{r.hospital_address}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.joining_date ? fmtDate(r.joining_date) : "—"}</TableCell>
                    <TableCell><AppStatusBadge status={r.status} testId={`report-status-${r.id}`} /></TableCell>
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
