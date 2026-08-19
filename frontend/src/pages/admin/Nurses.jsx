import { useEffect, useMemo, useState, useCallback } from "react";
import { UserRound } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { LoadingState, ErrorState, EmptyState } from "../../components/nurse/States";
import { VerificationBadge } from "../../components/nurse/Badges";
import { ConfirmDialog, RejectDialog } from "../../components/admin/AdminDialogs";
import { useAdminDocuments, DocumentList } from "../../components/admin/adminShared";
import { Card, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { toast } from "sonner";

export default function AdminNurses() {
  const [nurses, setNurses] = useState(null);
  const [emails, setEmails] = useState({});
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "all", qualification: "", location: "" });
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const { docs, ensureLoaded } = useAdminDocuments();

  const load = useCallback(() => {
    setError(null);
    setNurses(null);
    Promise.all([api.get("/nurse_profile"), api.get("/admin/users")])
      .then(([np, u]) => {
        setNurses(np.data || []);
        setEmails(Object.fromEntries((u.data || []).map((x) => [x.id, x.email])));
      })
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const filtered = useMemo(() => {
    if (!nurses) return [];
    const has = (v, n) => String(v || "").toLowerCase().includes(n.toLowerCase());
    return nurses.filter((n) => {
      const st = n.verification_status || "pending";
      if (filters.search && !(has(n.full_name, filters.search) || has(emails[n.owner_id], filters.search) || has(n.registration_number, filters.search))) return false;
      if (filters.status !== "all" && st !== filters.status) return false;
      if (filters.qualification && !has(n.qualification, filters.qualification)) return false;
      if (filters.location && !(has(n.city, filters.location) || has(n.state, filters.location) || has(n.preferred_location, filters.location))) return false;
      return true;
    });
  }, [nurses, filters, emails]);

  const patch = async (nurse, payload, msg) => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/nurse_profile/${nurse.id}`, payload);
      setNurses((ns) => ns.map((x) => (x.id === nurse.id ? data : x)));
      if (detail?.id === nurse.id) setDetail(data);
      toast.success(msg);
      setConfirm(null);
      setRejectFor(null);
    } catch (e) {
      toast.error(apiError(e, "Update failed"));
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (n) => { setDetail(n); setEditing(false); await ensureLoaded(); };

  const startEdit = () => {
    setForm({
      full_name: detail.full_name || "", phone: detail.phone || "", qualification: detail.qualification || "",
      registration_number: detail.registration_number || "", experience_years: detail.experience_years ?? "",
      city: detail.city || "", state: detail.state || "", preferred_shift: detail.preferred_shift || "",
      expected_salary: detail.expected_salary ?? "", departments: (detail.departments || []).join(", "),
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    const payload = { ...form, departments: form.departments ? form.departments.split(",").map((s) => s.trim()).filter(Boolean) : [] };
    await patch(detail, payload, "Nurse profile updated");
    setEditing(false);
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!nurses) return <LoadingState label="Loading nurses..." />;

  return (
    <div data-testid="admin-nurses-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Nurses</h1>
        <p className="text-sm text-slate-500 mt-1">{nurses.length} nurse profile{nurses.length === 1 ? "" : "s"} · verification management</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input data-testid="nurse-filter-search" className="w-56" placeholder="Search name, email, reg. no." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger data-testid="nurse-filter-status" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Input data-testid="nurse-filter-qualification" className="w-48" placeholder="Qualification" value={filters.qualification} onChange={(e) => setFilters({ ...filters, qualification: e.target.value })} />
        <Input data-testid="nurse-filter-location" className="w-48" placeholder="Location" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState testId="admin-nurses-empty" icon={UserRound} title={nurses.length === 0 ? "No nurse profiles yet" : "No nurses match your filters"}
          description={nurses.length === 0 ? "Nurse profiles will appear here once nurses complete registration." : "Try adjusting the filters."} />
      ) : (
        <Card className="border-slate-200">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Name", "Email", "Mobile", "Qualification", "Reg. No.", "Experience", "Location", "Status", ""].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((n) => (
                  <TableRow key={n.id} data-testid={`admin-nurse-row-${n.id}`}>
                    <TableCell className="font-medium text-slate-800 whitespace-nowrap">{n.full_name || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{emails[n.owner_id] || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{n.phone || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{n.qualification || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{n.registration_number || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{n.experience_years !== undefined && n.experience_years !== "" ? `${n.experience_years} yrs` : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{[n.city, n.state].filter(Boolean).join(", ") || "—"}</TableCell>
                    <TableCell><VerificationBadge status={n.verification_status} testId={`nurse-status-${n.id}`} /></TableCell>
                    <TableCell>
                      <Button data-testid={`view-nurse-btn-${n.id}`} variant="outline" size="sm" onClick={() => openDetail(n)}>Review</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent data-testid="admin-nurse-detail-dialog" className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-2">{detail.full_name || "Nurse profile"} <VerificationBadge status={detail.verification_status} testId="detail-nurse-status" /></DialogTitle>
                <DialogDescription>{emails[detail.owner_id] || ""}</DialogDescription>
              </DialogHeader>
              {editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    ["full_name", "Full name"], ["phone", "Mobile"], ["qualification", "Qualification"],
                    ["registration_number", "Registration number"], ["experience_years", "Experience (years)"],
                    ["city", "City"], ["state", "State"], ["preferred_shift", "Preferred shift"],
                    ["expected_salary", "Expected salary"], ["departments", "Departments (comma separated)"],
                  ].map(([k, label]) => (
                    <div key={k} className="space-y-1">
                      <label className="text-xs text-slate-500">{label}</label>
                      <Input data-testid={`edit-nurse-${k}`} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                    </div>
                  ))}
                </div>
              ) : (
              <dl className="space-y-2 text-sm">
                {[
                  ["Mobile", detail.phone],
                  ["Qualification", detail.qualification],
                  ["Registration number", detail.registration_number],
                  ["Experience", detail.experience_years !== undefined && detail.experience_years !== "" ? `${detail.experience_years} years` : null],
                  ["Departments", (detail.departments || []).join(", ") || null],
                  ["Location", [detail.city, detail.state].filter(Boolean).join(", ") || null],
                  ["Preferred shift", detail.preferred_shift],
                  ["Expected salary", detail.expected_salary ? `₹${Number(detail.expected_salary).toLocaleString()}/month` : null],
                  ["Rejection reason", detail.rejection_reason],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-medium text-slate-800 text-right">{v}</dd>
                  </div>
                ))}
              </dl>
              )}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <p className="text-sm font-semibold text-slate-800">Verification documents</p>
                <DocumentList docs={docs} ownerId={detail.owner_id} emptyText="No documents uploaded by this nurse." />
              </div>
              <div className="flex justify-end gap-2 flex-wrap pt-2">
                {editing ? (
                  <>
                    <Button data-testid="cancel-edit-nurse-btn" variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button data-testid="save-nurse-btn" size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={busy} onClick={saveEdit}>Save Changes</Button>
                  </>
                ) : (
                  <>
                    <Button data-testid="edit-nurse-btn" variant="outline" size="sm" onClick={startEdit}>Edit Profile</Button>
                    {detail.verification_status !== "under_review" && detail.verification_status !== "verified" && (
                      <Button data-testid="mark-under-review-btn" variant="outline" size="sm" disabled={busy} onClick={() => patch(detail, { verification_status: "under_review" }, "Marked under review")}>Mark Under Review</Button>
                    )}
                    {detail.verification_status !== "rejected" && (
                      <Button data-testid="reject-nurse-btn" variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectFor(detail)}>Reject</Button>
                    )}
                    {detail.verification_status !== "verified" && (
                      <Button data-testid="approve-nurse-btn" size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setConfirm(detail)}>Approve Nurse</Button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} busy={busy}
        title="Approve this nurse?" description={`${confirm?.full_name || "This nurse"} will be marked as Verified across the platform.`}
        confirmLabel="Approve" onConfirm={() => patch(confirm, { verification_status: "verified", rejection_reason: "" }, "Nurse verified")} />

      <RejectDialog open={!!rejectFor} onClose={() => setRejectFor(null)} busy={busy}
        title="Reject nurse verification" description={`Provide a reason. ${rejectFor?.full_name || "The nurse"} will see the Rejected status.`}
        onSubmit={(reason) => patch(rejectFor, { verification_status: "rejected", rejection_reason: reason }, "Nurse verification rejected")} />
    </div>
  );
}
