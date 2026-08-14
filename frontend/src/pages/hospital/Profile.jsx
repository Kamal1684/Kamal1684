import { useEffect, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2, FileText, Upload, Trash2, Download } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { fmtDate } from "../../lib/status";
import { VerificationBadge } from "../../components/nurse/Badges";
import { LoadingState, ErrorState } from "../../components/nurse/States";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "sonner";

const MAX_FILE = 2 * 1024 * 1024;
const HOSPITAL_TYPES = ["Multi-specialty", "Super-specialty", "General", "Clinic", "Nursing Home", "Government", "Other"];
const emptyForm = { name: "", phone: "", address: "", city: "", state: "", pincode: "", hospital_type: "", beds: "", license_number: "" };

export default function HospitalProfile() {
  const { refreshHospital } = useOutletContext();
  const [hospital, setHospital] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [docBusy, setDocBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setLoaded(false);
    Promise.all([api.get("/hospital"), api.get("/document")])
      .then(([h, d]) => {
        const rec = h.data[0] || null;
        setHospital(rec);
        setDocs((d.data || []).filter((x) => x.doc_type === "hospital_license"));
        if (rec) setForm({ ...emptyForm, ...Object.fromEntries(Object.keys(emptyForm).map((k) => [k, rec[k] ?? ""])) });
        setLoaded(true);
      })
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Hospital name is required"); return; }
    setSaving(true);
    const payload = { ...form, beds: form.beds === "" ? "" : Number(form.beds) };
    try {
      let saved;
      if (hospital) {
        ({ data: saved } = await api.patch(`/hospital/${hospital.id}`, payload));
      } else {
        ({ data: saved } = await api.post("/hospital", { ...payload, verification_status: "pending", public: false }));
      }
      setHospital(saved);
      refreshHospital?.();
      toast.success("Hospital profile saved");
    } catch (err) {
      toast.error(apiError(err, "Could not save profile"));
    } finally {
      setSaving(false);
    }
  };

  const uploadDoc = async (file) => {
    if (file.size > MAX_FILE) { toast.error("File too large (max 2 MB)"); return; }
    setDocBusy(true);
    try {
      const data_base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const existing = docs[0];
      const { data } = await api.post("/document", { doc_type: "hospital_license", file_name: file.name, file_size: file.size, content_type: file.type, data_base64 });
      if (existing) await api.delete(`/document/${existing.id}`).catch(() => {});
      setDocs([data]);
      toast.success("License uploaded securely");
    } catch (err) {
      toast.error(apiError(err, "Upload failed"));
    } finally {
      setDocBusy(false);
    }
  };

  const deleteDoc = async (doc) => {
    setDocBusy(true);
    try {
      await api.delete(`/document/${doc.id}`);
      setDocs([]);
      toast.success("Document removed");
    } catch (err) {
      toast.error(apiError(err, "Could not delete document"));
    } finally {
      setDocBusy(false);
    }
  };

  const download = (doc) => {
    const a = document.createElement("a");
    a.href = `data:${doc.content_type || "application/octet-stream"};base64,${doc.data_base64}`;
    a.download = doc.file_name || "license.file";
    a.click();
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!loaded) return <LoadingState label="Loading hospital profile..." />;

  const license = docs[0];

  return (
    <div data-testid="hospital-profile-page" className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Hospital Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Keep your hospital details accurate to build trust with nurses</p>
        </div>
        <VerificationBadge status={hospital?.verification_status} testId="hospital-profile-verification-badge" />
      </div>

      <form onSubmit={save} className="space-y-6">
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="font-heading text-lg">Hospital Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["name", "Hospital name", "e.g. City Care Hospital"],
              ["phone", "Phone", "e.g. +91 22 1234 5678"],
              ["address", "Address", "Street address"],
              ["city", "City", "e.g. Mumbai"],
              ["state", "State", "e.g. Maharashtra"],
              ["pincode", "Pincode", "e.g. 400001"],
            ].map(([id, label, ph]) => (
              <div key={id} className="space-y-1.5">
                <Label htmlFor={`h-${id}`}>{label}</Label>
                <Input data-testid={`hospital-${id}-input`} id={`h-${id}`} value={form[id]} placeholder={ph} onChange={(e) => set(id)(e.target.value)} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Hospital type</Label>
              <Select value={form.hospital_type} onValueChange={set("hospital_type")}>
                <SelectTrigger data-testid="hospital-type-select"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {HOSPITAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-beds">Number of beds</Label>
              <Input data-testid="hospital-beds-input" id="h-beds" type="number" min="0" value={form.beds} placeholder="e.g. 250" onChange={(e) => set("beds")(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="h-license">Registration / license number</Label>
              <Input data-testid="hospital-license_number-input" id="h-license" value={form.license_number} placeholder="e.g. MH-HOSP-12345" onChange={(e) => set("license_number")(e.target.value)} />
            </div>
          </CardContent>
        </Card>
        <Button data-testid="hospital-profile-save-btn" type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Profile
        </Button>
      </form>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Hospital License</CardTitle>
          <CardDescription>Private to your hospital and admins. PDF/JPG/PNG up to 2 MB. Required for verification.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">License document</p>
                <p className="text-xs text-slate-500 truncate">
                  {license ? `${license.file_name} · uploaded ${fmtDate(license.created_at)}` : "Not uploaded yet"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {license?.data_base64 && (
                <Button data-testid="hospital-license-download-btn" variant="ghost" size="sm" onClick={() => download(license)}><Download className="h-4 w-4" /></Button>
              )}
              {license && (
                <Button data-testid="hospital-license-delete-btn" variant="ghost" size="sm" className="text-red-600" disabled={docBusy} onClick={() => deleteDoc(license)}><Trash2 className="h-4 w-4" /></Button>
              )}
              <label>
                <input data-testid="document-upload-hospital_license" type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" disabled={docBusy}
                  onChange={(e) => e.target.files[0] && uploadDoc(e.target.files[0])} />
                <span className={`inline-flex items-center gap-1.5 text-sm font-medium border border-slate-200 rounded-md px-3 py-1.5 cursor-pointer hover:bg-slate-50 ${docBusy ? "opacity-50 pointer-events-none" : ""}`}>
                  <Upload className="h-3.5 w-3.5" /> {license ? "Replace" : "Upload"}
                </span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
