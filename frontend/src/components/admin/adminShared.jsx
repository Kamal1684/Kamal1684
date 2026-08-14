import { useState, useCallback } from "react";
import { FileText, Download } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { fmtDate } from "../../lib/status";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

export const PENDING_STATUSES = new Set(["pending", "under_review"]);

export const DOC_LABELS = {
  qualification_certificate: "Qualification Certificate",
  registration_certificate: "Nursing Registration Certificate",
  id_proof: "ID Proof",
  hospital_license: "Hospital License",
};

export function useAdminDocuments() {
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(false);

  const ensureLoaded = useCallback(async () => {
    if (docs || loading) return docs;
    setLoading(true);
    try {
      const { data } = await api.get("/document");
      setDocs(data || []);
      return data || [];
    } catch (e) {
      toast.error(apiError(e, "Could not load documents"));
      return [];
    } finally {
      setLoading(false);
    }
  }, [docs, loading]);

  return { docs, loading, ensureLoaded };
}

export function downloadDoc(doc) {
  const a = document.createElement("a");
  a.href = `data:${doc.content_type || "application/octet-stream"};base64,${doc.data_base64}`;
  a.download = doc.file_name || "document.file";
  a.click();
}

export function DocumentList({ docs, ownerId, emptyText = "No documents uploaded." }) {
  const owned = (docs || []).filter((d) => d.owner_id === ownerId);
  if (owned.length === 0) return <p data-testid="admin-docs-empty" className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <ul className="space-y-2">
      {owned.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{DOC_LABELS[d.doc_type] || d.doc_type || "Document"}</p>
              <p className="text-xs text-slate-500 truncate">{d.file_name} · {fmtDate(d.created_at)}</p>
            </div>
          </div>
          {d.data_base64 && (
            <Button data-testid={`admin-doc-download-${d.id}`} variant="ghost" size="sm" onClick={() => downloadDoc(d)}>
              <Download className="h-4 w-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
