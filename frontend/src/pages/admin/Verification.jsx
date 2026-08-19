import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { UserRound, Building2 } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { LoadingState, ErrorState } from "../../components/nurse/States";
import { VerificationBadge } from "../../components/nurse/Badges";
import { ConfirmDialog, RejectDialog } from "../../components/admin/AdminDialogs";
import { PENDING_STATUSES, useAdminDocuments, DocumentList } from "../../components/admin/adminShared";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { toast } from "sonner";

function Section({ title, icon: Icon, count, children, testId }) {
  return (
    <Card data-testid={testId} className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <Icon className="h-5 w-5 text-indigo-600" /> {title}
          <span className="text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-0.5">{count}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function Verification() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nurseSearch, setNurseSearch] = useState("");
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [docsFor, setDocsFor] = useState(null);
  const navigate = useNavigate();
  const { docs, ensureLoaded } = useAdminDocuments();

  const load = useCallback(() => {
    setError(null);
    setData(null);
    Promise.all([api.get("/nurse_profile"), api.get("/hospital")])
      .then(([np, h]) => setData({ nurses: np.data || [], hospitals: h.data || [] }))
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const act = async (target, payload, msg) => {
    setBusy(true);
    try {
      await api.patch(`/${target.resource}/${target.item.id}`, payload);
      toast.success(msg);
      setConfirm(null);
      setRejectFor(null);
      load();
    } catch (e) {
      toast.error(apiError(e, "Action failed"));
      setBusy(false);
    }
  };

  const openDocs = async (owner) => { setDocsFor(owner); await ensureLoaded(); };

  const has = (v, q) => String(v || "").toLowerCase().includes(q.toLowerCase());

  const pendingNurses = useMemo(() => {
    if (!data) return [];
    return data.nurses
      .filter((n) => PENDING_STATUSES.has(n.verification_status || "pending"))
      .filter((n) => !nurseSearch || has(n.full_name, nurseSearch) || has(n.qualification, nurseSearch) || has(n.city, nurseSearch) || has(n.state, nurseSearch));
  }, [data, nurseSearch]);

  const pendingHospitals = useMemo(() => {
    if (!data) return [];
    return data.hospitals
      .filter((h) => PENDING_STATUSES.has(h.verification_status || "pending"))
      .filter((h) => !hospitalSearch || has(h.name, hospitalSearch) || has(h.hospital_type, hospitalSearch) || has(h.city, hospitalSearch) || has(h.state, hospitalSearch));
  }, [data, hospitalSearch]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading verification queue..." />;

  const row = (key, primary, secondary, badge, actions) => (
    <li key={key} className="py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <p className="font-medium text-slate-800 truncate">{primary}</p>
        <p className="text-xs text-slate-500">{secondary}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">{badge}{actions}</div>
    </li>
  );

  return (
    <div data-testid="admin-verification-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Verification Center</h1>
        <p className="text-sm text-slate-500 mt-1">Review and verify hospitals and nurses</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section testId="verification-hospitals-section" title="Hospital Verification" icon={Building2} count={pendingHospitals.length}>
          <Input data-testid="verification-hospital-search" className="mb-3" placeholder="Search hospitals by name, type or location..." value={hospitalSearch} onChange={(e) => setHospitalSearch(e.target.value)} />
          {pendingHospitals.length === 0 ? <p className="text-sm text-slate-500">No hospitals awaiting verification.</p> : (
            <ul className="divide-y divide-slate-100">
              {pendingHospitals.map((h) => row(h.id, h.name || "Unnamed hospital", `${h.hospital_type || "—"} · ${[h.city, h.state].filter(Boolean).join(", ") || "—"}`,
                <VerificationBadge status={h.verification_status} testId={`vc-hospital-status-${h.id}`} />,
                <>
                  <Button data-testid={`vc-docs-hospital-${h.id}`} variant="outline" size="sm" onClick={() => openDocs({ id: h.owner_id, label: h.name, kind: "hospital" })}>View Documents</Button>
                  <Button data-testid={`vc-review-hospital-${h.id}`} variant="outline" size="sm" onClick={() => navigate("/admin/hospitals")}>Review</Button>
                  <Button data-testid={`vc-approve-hospital-${h.id}`} size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setConfirm({ resource: "hospital", item: h, label: h.name || "this hospital" })}>Approve</Button>
                  <Button data-testid={`vc-reject-hospital-${h.id}`} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectFor({ resource: "hospital", item: h, label: h.name || "this hospital" })}>Reject</Button>
                </>))}
            </ul>
          )}
        </Section>

        <Section testId="verification-nurses-section" title="Nurse Verification" icon={UserRound} count={pendingNurses.length}>
          <Input data-testid="verification-nurse-search" className="mb-3" placeholder="Search nurses by name, qualification or location..." value={nurseSearch} onChange={(e) => setNurseSearch(e.target.value)} />
          {pendingNurses.length === 0 ? <p className="text-sm text-slate-500">No nurses awaiting verification.</p> : (
            <ul className="divide-y divide-slate-100">
              {pendingNurses.map((n) => row(n.id, n.full_name || "Unnamed nurse", `${n.qualification || "—"} · ${[n.city, n.state].filter(Boolean).join(", ") || "—"}`,
                <VerificationBadge status={n.verification_status} testId={`vc-nurse-status-${n.id}`} />,
                <>
                  <Button data-testid={`vc-docs-nurse-${n.id}`} variant="outline" size="sm" onClick={() => openDocs({ id: n.owner_id, label: n.full_name, kind: "nurse" })}>View Documents</Button>
                  <Button data-testid={`vc-review-nurse-${n.id}`} variant="outline" size="sm" onClick={() => navigate("/admin/nurses")}>Review</Button>
                  <Button data-testid={`vc-approve-nurse-${n.id}`} size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setConfirm({ resource: "nurse_profile", item: n, label: n.full_name || "this nurse" })}>Approve</Button>
                  <Button data-testid={`vc-reject-nurse-${n.id}`} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectFor({ resource: "nurse_profile", item: n, label: n.full_name || "this nurse" })}>Reject</Button>
                </>))}
            </ul>
          )}
        </Section>
      </div>

      <Dialog open={!!docsFor} onOpenChange={(o) => !o && setDocsFor(null)}>
        <DialogContent data-testid="verification-documents-dialog" className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Documents — {docsFor?.label || (docsFor?.kind === "hospital" ? "Hospital" : "Nurse")}</DialogTitle>
            <DialogDescription>{docsFor?.kind === "hospital" ? "License and verification documents." : "Qualification and registration documents."}</DialogDescription>
          </DialogHeader>
          {docs === null ? <LoadingState label="Loading documents..." /> : <DocumentList docs={docs} ownerId={docsFor?.id} emptyText="No documents uploaded." />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} busy={busy}
        title={`Approve ${confirm?.label || ""}?`}
        description="The Verified badge will be applied across the platform."
        confirmLabel="Approve"
        onConfirm={() => act(confirm, { verification_status: "verified", rejection_reason: "" }, "Approved")} />

      <RejectDialog open={!!rejectFor} onClose={() => setRejectFor(null)} busy={busy}
        title={`Reject ${rejectFor?.label || ""}`} description="Provide a reason. The owner will see the rejected status."
        onSubmit={(reason) => act(rejectFor, { verification_status: "rejected", rejection_reason: reason }, "Rejected")} />
    </div>
  );
}
