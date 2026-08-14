import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, UserRound, Building2, Briefcase, FileText } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { fmtDate, jobState } from "../../lib/status";
import { LoadingState, ErrorState } from "../../components/nurse/States";
import { VerificationBadge } from "../../components/nurse/Badges";
import { ConfirmDialog, RejectDialog } from "../../components/admin/AdminDialogs";
import { PENDING_STATUSES, DOC_LABELS, downloadDoc } from "../../components/admin/adminShared";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
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
  const navigate = useNavigate();

  const load = useCallback(() => {
    setError(null);
    setData(null);
    Promise.all([api.get("/nurse_profile"), api.get("/hospital"), api.get("/job"), api.get("/document")])
      .then(([np, h, j, d]) => setData({ nurses: np.data || [], hospitals: h.data || [], jobs: j.data || [], docs: d.data || [] }))
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

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading verification queue..." />;

  const pendingNurses = data.nurses.filter((n) => PENDING_STATUSES.has(n.verification_status || "pending"));
  const pendingHospitals = data.hospitals.filter((h) => PENDING_STATUSES.has(h.verification_status || "pending"));
  const pendingJobs = data.jobs.filter((j) => jobState(j) === "pending_approval");
  const pendingOwners = new Set([...pendingNurses.map((n) => n.owner_id), ...pendingHospitals.map((h) => h.owner_id)]);
  const pendingDocs = data.docs.filter((d) => pendingOwners.has(d.owner_id));

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
        <p className="text-sm text-slate-500 mt-1">Everything awaiting admin review, in one place</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section testId="verification-pending-nurses" title="Pending Nurses" icon={UserRound} count={pendingNurses.length}>
          {pendingNurses.length === 0 ? <p className="text-sm text-slate-500">No nurses awaiting verification.</p> : (
            <ul className="divide-y divide-slate-100">
              {pendingNurses.map((n) => row(n.id, n.full_name || "Unnamed nurse", `${n.qualification || "—"} · ${[n.city, n.state].filter(Boolean).join(", ") || "—"}`,
                <VerificationBadge status={n.verification_status} testId={`vc-nurse-status-${n.id}`} />,
                <>
                  <Button data-testid={`vc-review-nurse-${n.id}`} variant="outline" size="sm" onClick={() => navigate("/admin/nurses")}>Review</Button>
                  <Button data-testid={`vc-approve-nurse-${n.id}`} size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setConfirm({ resource: "nurse_profile", item: n, label: n.full_name || "this nurse", kind: "nurse" })}>Approve</Button>
                  <Button data-testid={`vc-reject-nurse-${n.id}`} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectFor({ resource: "nurse_profile", item: n, label: n.full_name || "this nurse" })}>Reject</Button>
                </>))}
            </ul>
          )}
        </Section>

        <Section testId="verification-pending-hospitals" title="Pending Hospitals" icon={Building2} count={pendingHospitals.length}>
          {pendingHospitals.length === 0 ? <p className="text-sm text-slate-500">No hospitals awaiting verification.</p> : (
            <ul className="divide-y divide-slate-100">
              {pendingHospitals.map((h) => row(h.id, h.name || "Unnamed hospital", `${h.hospital_type || "—"} · ${[h.city, h.state].filter(Boolean).join(", ") || "—"}`,
                <VerificationBadge status={h.verification_status} testId={`vc-hospital-status-${h.id}`} />,
                <>
                  <Button data-testid={`vc-review-hospital-${h.id}`} variant="outline" size="sm" onClick={() => navigate("/admin/hospitals")}>Review</Button>
                  <Button data-testid={`vc-approve-hospital-${h.id}`} size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setConfirm({ resource: "hospital", item: h, label: h.name || "this hospital", kind: "hospital" })}>Approve</Button>
                  <Button data-testid={`vc-reject-hospital-${h.id}`} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectFor({ resource: "hospital", item: h, label: h.name || "this hospital" })}>Reject</Button>
                </>))}
            </ul>
          )}
        </Section>

        <Section testId="verification-pending-jobs" title="Pending Jobs" icon={Briefcase} count={pendingJobs.length}>
          {pendingJobs.length === 0 ? <p className="text-sm text-slate-500">No jobs awaiting approval.</p> : (
            <ul className="divide-y divide-slate-100">
              {pendingJobs.map((j) => row(j.id, j.title || "Untitled job", `${j.hospital_name || "Hospital"} · ${j.department || "—"} · ${j.location || "—"}`,
                null,
                <>
                  <Button data-testid={`vc-review-job-${j.id}`} variant="outline" size="sm" onClick={() => navigate("/admin/jobs")}>Review</Button>
                  <Button data-testid={`vc-approve-job-${j.id}`} size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setConfirm({ resource: "job", item: j, label: `"${j.title}"`, kind: "job" })}>Approve</Button>
                  <Button data-testid={`vc-reject-job-${j.id}`} variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectFor({ resource: "job", item: j, label: `"${j.title}"` })}>Reject</Button>
                </>))}
            </ul>
          )}
        </Section>

        <Section testId="verification-pending-documents" title="Pending Documents" icon={FileText} count={pendingDocs.length}>
          {pendingDocs.length === 0 ? <p className="text-sm text-slate-500">No documents awaiting review.</p> : (
            <ul className="divide-y divide-slate-100">
              {pendingDocs.map((d) => row(d.id, DOC_LABELS[d.doc_type] || d.doc_type || "Document", `${d.file_name || ""} · ${fmtDate(d.created_at)}`,
                null,
                d.data_base64 && <Button data-testid={`vc-download-doc-${d.id}`} variant="outline" size="sm" onClick={() => downloadDoc(d)}>Download</Button>))}
            </ul>
          )}
        </Section>
      </div>

      <ConfirmDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} busy={busy}
        title={`Approve ${confirm?.label || ""}?`}
        description={confirm?.kind === "job" ? "The job will be published to all nurses and matching alerts will be sent." : "The Verified badge will be applied across the platform."}
        confirmLabel="Approve"
        onConfirm={() => act(confirm, confirm.kind === "job" ? { approved: true, published: true, status: "active", rejection_reason: "" } : { verification_status: "verified", rejection_reason: "" }, "Approved")} />

      <RejectDialog open={!!rejectFor} onClose={() => setRejectFor(null)} busy={busy}
        title={`Reject ${rejectFor?.label || ""}`} description="Provide a reason. The owner will see the rejected status."
        onSubmit={(reason) => act(rejectFor, rejectFor.resource === "job" ? { approved: false, published: false, status: "rejected", rejection_reason: reason } : { verification_status: "rejected", rejection_reason: reason }, "Rejected")} />
    </div>
  );
}
