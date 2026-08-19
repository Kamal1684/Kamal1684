import { useEffect, useMemo, useState, useCallback } from "react";
import { Building2 } from "lucide-react";
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

export default function AdminHospitals() {
  const [hospitals, setHospitals] = useState(null);
  const [emails, setEmails] = useState({});
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "all", location: "", type: "" });
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const { docs, ensureLoaded } = useAdminDocuments();

  const load = useCallback(() => {
    setError(null);
    setHospitals(null);
    Promise.all([api.get("/hospital"), api.get("/admin/users")])
      .then(([h, u]) => {
        setHospitals(h.data || []);
        setEmails(Object.fromEntries((u.data || []).map((x) => [x.id, x.email])));
      })
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const filtered = useMemo(() => {
    if (!hospitals) return [];
    const has = (v, n) => String(v || "").toLowerCase().includes(n.toLowerCase());
    return hospitals.filter((h) => {
      const st = h.verification_status || "pending";
      if (filters.search && !(has(h.name, filters.search) || has(emails[h.owner_id], filters.search) || has(h.license_number, filters.search))) return false;
      if (filters.status !== "all" && st !== filters.status) return false;
      if (filters.location && !(has(h.city, filters.location) || has(h.state, filters.location) || has(h.address, filters.location))) return false;
      if (filters.type && !has(h.hospital_type, filters.type)) return false;
      return true;
    });
  }, [hospitals, filters, emails]);

  const patch = async (hosp, payload, msg) => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/hospital/${hosp.id}`, payload);
      setHospitals((hs) => hs.map((x) => (x.id === hosp.id ? data : x)));
      if (detail?.id === hosp.id) setDetail(data);
      toast.success(msg);
      setConfirm(null);
      setRejectFor(null);
    } catch (e) {
      toast.error(apiError(e, "Update failed"));
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (h) => { setDetail(h); setEditing(false); await ensureLoaded(); };

  const startEdit = () => {
    setForm({
      name: detail.name || "", phone: detail.phone || "", address: detail.address || "",
      city: detail.city || "", state: detail.state || "", pincode: detail.pincode || "",
      hospital_type: detail.hospital_type || "", beds: detail.beds ?? "", license_number: detail.license_number || "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    await patch(detail, { ...form }, "Hospital profile updated");
    setEditing(false);
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!hospitals) return <LoadingState label="Loading hospitals..." />;

  return (
    <div data-testid="admin-hospitals-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Hospitals</h1>
        <p className="text-sm text-slate-500 mt-1">{hospitals.length} hospital profile{hospitals.length === 1 ? "" : "s"} · verification management</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input data-testid="hospital-filter-search" className="w-56" placeholder="Search name, email, license" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger data-testid="hospital-filter-status" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Input data-testid="hospital-filter-location" className="w-48" placeholder="Location" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
        <Input data-testid="hospital-filter-type" className="w-48" placeholder="Hospital type" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState testId="admin-hospitals-empty" icon={Building2} title={hospitals.length === 0 ? "No hospital profiles yet" : "No hospitals match your filters"}
          description={hospitals.length === 0 ? "Hospital profiles will appear here once hospitals complete registration." : "Try adjusting the filters."} />
      ) : (
        <Card className="border-slate-200">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Hospital", "Email", "Mobile", "Location", "Type", "License No.", "Status", ""].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((h) => (
                  <TableRow key={h.id} data-testid={`admin-hospital-row-${h.id}`}>
                    <TableCell className="font-medium text-slate-800 whitespace-nowrap">{h.name || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{emails[h.owner_id] || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{h.phone || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{[h.city, h.state].filter(Boolean).join(", ") || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{h.hospital_type || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{h.license_number || "—"}</TableCell>
                    <TableCell><VerificationBadge status={h.verification_status} testId={`hospital-status-${h.id}`} /></TableCell>
                    <TableCell>
                      <Button data-testid={`view-hospital-btn-${h.id}`} variant="outline" size="sm" onClick={() => openDetail(h)}>Review</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent data-testid="admin-hospital-detail-dialog" className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-2">{detail.name || "Hospital"} <VerificationBadge status={detail.verification_status} testId="detail-hospital-status" /></DialogTitle>
                <DialogDescription>{emails[detail.owner_id] || ""}</DialogDescription>
              </DialogHeader>
              {editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    ["name", "Hospital name"], ["phone", "Mobile"], ["address", "Address"],
                    ["city", "City"], ["state", "State"], ["pincode", "Pincode"],
                    ["hospital_type", "Type"], ["beds", "Beds"], ["license_number", "License number"],
                  ].map(([k, label]) => (
                    <div key={k} className="space-y-1">
                      <label className="text-xs text-slate-500">{label}</label>
                      <Input data-testid={`edit-hospital-${k}`} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                    </div>
                  ))}
                </div>
              ) : (
              <dl className="space-y-2 text-sm">
                {[
                  ["Mobile", detail.phone],
                  ["Address", detail.address],
                  ["Location", [detail.city, detail.state, detail.pincode].filter(Boolean).join(", ") || null],
                  ["Type", detail.hospital_type],
                  ["Beds", detail.beds],
                  ["License number", detail.license_number],
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
                <p className="text-sm font-semibold text-slate-800">License documents</p>
                <DocumentList docs={docs} ownerId={detail.owner_id} emptyText="No license uploaded by this hospital." />
              </div>
              <div className="flex justify-end gap-2 flex-wrap pt-2">
                {editing ? (
                  <>
                    <Button data-testid="cancel-edit-hospital-btn" variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button data-testid="save-hospital-btn" size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={busy} onClick={saveEdit}>Save Changes</Button>
                  </>
                ) : (
                  <>
                    <Button data-testid="edit-hospital-btn" variant="outline" size="sm" onClick={startEdit}>Edit Profile</Button>
                    {detail.verification_status !== "under_review" && detail.verification_status !== "verified" && (
                      <Button data-testid="mark-hospital-under-review-btn" variant="outline" size="sm" disabled={busy} onClick={() => patch(detail, { verification_status: "under_review" }, "Marked under review")}>Mark Under Review</Button>
                    )}
                    {detail.verification_status !== "rejected" && (
                      <Button data-testid="reject-hospital-btn" variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectFor(detail)}>Reject</Button>
                    )}
                    {detail.verification_status !== "verified" && (
                      <Button data-testid="approve-hospital-btn" size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setConfirm(detail)}>Approve Hospital</Button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} busy={busy}
        title="Approve this hospital?" description={`${confirm?.name || "This hospital"} will receive the Verified Hospital badge on all its job postings.`}
        confirmLabel="Approve" onConfirm={() => patch(confirm, { verification_status: "verified", rejection_reason: "" }, "Hospital verified")} />

      <RejectDialog open={!!rejectFor} onClose={() => setRejectFor(null)} busy={busy}
        title="Reject hospital verification" description={`Provide a reason. ${rejectFor?.name || "The hospital"} will see the Rejected status.`}
        onSubmit={(reason) => patch(rejectFor, { verification_status: "rejected", rejection_reason: reason }, "Hospital verification rejected")} />
    </div>
  );
}
