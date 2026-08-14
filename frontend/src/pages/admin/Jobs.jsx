import { useEffect, useMemo, useState, useCallback } from "react";
import { Briefcase } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { fmtDate, fmtSalary, jobState, JOB_STATE_META } from "../../lib/status";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { JobMeta } from "../../components/nurse/JobCard";
import { ConfirmDialog, RejectDialog } from "../../components/admin/AdminDialogs";
import { Card, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { toast } from "sonner";

export default function AdminJobs() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ state: "all", department: "", location: "" });
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setJobs(null);
    api.get("/job").then((r) => setJobs(r.data || [])).catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const has = (v, n) => String(v || "").toLowerCase().includes(n.toLowerCase());
    return jobs.filter((j) => {
      if (filters.state !== "all" && jobState(j) !== filters.state) return false;
      if (filters.department && !has(j.department, filters.department)) return false;
      if (filters.location && !has(j.location, filters.location)) return false;
      return true;
    });
  }, [jobs, filters]);

  const patch = async (job, payload, msg) => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/job/${job.id}`, { ...payload, updated_at: new Date().toISOString() });
      setJobs((js) => js.map((x) => (x.id === job.id ? data : x)));
      if (detail?.id === job.id) setDetail(data);
      toast.success(msg);
      setConfirm(null);
      setRejectFor(null);
    } catch (e) {
      toast.error(apiError(e, "Update failed"));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!jobs) return <LoadingState label="Loading jobs..." />;

  const pendingCount = jobs.filter((j) => jobState(j) === "pending_approval").length;

  return (
    <div data-testid="admin-jobs-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Job Approvals</h1>
        <p className="text-sm text-slate-500 mt-1">{jobs.length} job{jobs.length === 1 ? "" : "s"} · {pendingCount} awaiting approval</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filters.state} onValueChange={(v) => setFilters({ ...filters, state: v })}>
          <SelectTrigger data-testid="job-filter-state" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Input data-testid="job-filter-department" className="w-48" placeholder="Department" value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })} />
        <Input data-testid="job-filter-location" className="w-48" placeholder="Location" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState testId="admin-jobs-empty" icon={Briefcase} title={jobs.length === 0 ? "No jobs posted yet" : "No jobs match your filters"}
          description={jobs.length === 0 ? "Jobs posted by hospitals will appear here for moderation." : "Try adjusting the filters."} />
      ) : (
        <Card className="border-slate-200">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Job", "Hospital", "Department", "Location", "Salary", "Exp.", "Shift", "Openings", "Status", "Created", ""].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((j) => {
                  const st = JOB_STATE_META[jobState(j)];
                  return (
                    <TableRow key={j.id} data-testid={`admin-job-row-${j.id}`}>
                      <TableCell className="font-medium text-slate-800 whitespace-nowrap">{j.title || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{j.hospital_name || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{j.department || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{j.location || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtSalary(j)}</TableCell>
                      <TableCell className="whitespace-nowrap">{j.experience_required !== undefined && j.experience_required !== "" ? `${j.experience_required} yrs` : "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{j.shift || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{j.openings || "—"}</TableCell>
                      <TableCell><Badge data-testid={`admin-job-state-${j.id}`} variant="outline" className={st.cls}>{st.label}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(j.created_at)}</TableCell>
                      <TableCell>
                        <Button data-testid={`admin-view-job-btn-${j.id}`} variant="outline" size="sm" onClick={() => setDetail(j)}>Review</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent data-testid="admin-job-detail-dialog" className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-2 flex-wrap">
                  {detail.title}
                  <Badge variant="outline" className={JOB_STATE_META[jobState(detail)].cls}>{JOB_STATE_META[jobState(detail)].label}</Badge>
                </DialogTitle>
                <DialogDescription>{detail.hospital_name || "Hospital"} · posted {fmtDate(detail.created_at)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <JobMeta job={detail} />
                {detail.application_deadline && <p className="text-sm text-slate-600"><span className="font-medium text-slate-800">Apply by:</span> {fmtDate(detail.application_deadline)}</p>}
                {(detail.skills || []).length > 0 && <p className="text-sm text-slate-600"><span className="font-medium text-slate-800">Skills:</span> {detail.skills.join(", ")}</p>}
                {detail.description && <p className="text-sm text-slate-600 whitespace-pre-wrap">{detail.description}</p>}
                {detail.status === "rejected" && detail.rejection_reason && (
                  <p data-testid="admin-job-rejection-reason" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">Rejection reason: {detail.rejection_reason}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 flex-wrap pt-2">
                {jobState(detail) !== "published" && jobState(detail) !== "closed" && (
                  <Button data-testid="approve-job-btn" size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setConfirm(detail)}>Approve &amp; Publish</Button>
                )}
                {jobState(detail) !== "rejected" && jobState(detail) !== "closed" && (
                  <Button data-testid="reject-job-btn" variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectFor(detail)}>Reject</Button>
                )}
                {jobState(detail) === "published" && (
                  <Button data-testid="admin-close-job-btn" variant="outline" size="sm" disabled={busy} onClick={() => patch(detail, { status: "closed" }, "Job closed")}>Close Job</Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} busy={busy}
        title="Approve and publish this job?" description={`"${confirm?.title}" will become visible to all nurses and matching alerts will be sent.`}
        confirmLabel={"Approve & Publish"} onConfirm={() => patch(confirm, { approved: true, published: true, status: "active", rejection_reason: "" }, "Job approved and published")} />

      <RejectDialog open={!!rejectFor} onClose={() => setRejectFor(null)} busy={busy}
        title="Reject this job" description={`Provide a reason. "${rejectFor?.title}" will be unpublished and the hospital will see the reason.`}
        onSubmit={(reason) => patch(rejectFor, { approved: false, published: false, status: "rejected", rejection_reason: reason }, "Job rejected")} />
    </div>
  );
}
