import { useEffect, useState, useCallback } from "react";
import { Loader2, FileText, Upload, Trash2, Download } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { profileCompletion } from "../../lib/match";
import { fmtDate } from "../../lib/status";
import { VerificationBadge } from "../../components/nurse/Badges";
import { LoadingState, ErrorState } from "../../components/nurse/States";
import { ChangePasswordCard } from "../../components/ChangePasswordCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { Progress } from "../../components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";

const DOC_TYPES = [
  { key: "qualification_certificate", label: "Qualification Certificate" },
  { key: "registration_certificate", label: "Nursing Registration Certificate" },
  { key: "id_proof", label: "ID Proof" },
];
const MAX_FILE = 2 * 1024 * 1024;
const SHIFTS = ["Day", "Night", "Rotational", "Flexible"];
const STATES = ["Haryana", "Delhi", "Himachal Pradesh", "Punjab", "Chandigarh"];

const emptyForm = {
  full_name: "", phone: "", city: "", state: "",
  qualification: "", registration_number: "", experience_years: "", departments: "",
  preferred_location: "", expected_salary: "", preferred_shift: "",
  accommodation_required: false, willing_to_relocate: false,
};

function Field({ id, label, value, onChange, type = "text", placeholder, readOnly = false }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input data-testid={`profile-${id}-input`} id={id} type={type} value={value} placeholder={placeholder}
        readOnly={readOnly} className={readOnly ? "bg-slate-50 text-slate-500 cursor-not-allowed" : undefined}
        onChange={(e) => onChange && onChange(e.target.value)} />
    </div>
  );
}

function DocumentRow({ type, doc, onUpload, onDelete, busy }) {
  const download = () => {
    const a = document.createElement("a");
    a.href = `data:${doc.content_type || "application/octet-stream"};base64,${doc.data_base64}`;
    a.download = doc.file_name || `${type.key}.file`;
    a.click();
  };
  return (
    <div className="flex items-center justify-between gap-3 py-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{type.label}</p>
          <p className="text-xs text-slate-500 truncate">
            {doc ? `${doc.file_name} · uploaded ${fmtDate(doc.created_at)}` : "Not uploaded yet"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {doc && doc.data_base64 && (
          <Button data-testid={`document-download-${type.key}`} variant="ghost" size="sm" onClick={download}>
            <Download className="h-4 w-4" />
          </Button>
        )}
        {doc && (
          <Button data-testid={`document-delete-${type.key}`} variant="ghost" size="sm" className="text-red-600" disabled={busy} onClick={() => onDelete(doc)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <label>
          <input data-testid={`document-upload-${type.key}`} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" disabled={busy}
            onChange={(e) => e.target.files[0] && onUpload(type.key, e.target.files[0])} />
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium border border-slate-200 rounded-md px-3 py-1.5 cursor-pointer hover:bg-slate-50 ${busy ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="h-3.5 w-3.5" /> {doc ? "Replace" : "Upload"}
          </span>
        </label>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [docBusy, setDocBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setLoaded(false);
    Promise.all([api.get("/nurse_profile"), api.get("/document")])
      .then(([np, d]) => {
        const p = np.data[0] || null;
        setProfile(p);
        setDocs(d.data || []);
        if (p) {
          setForm({
            ...emptyForm,
            ...Object.fromEntries(Object.keys(emptyForm).map((k) => [k, p[k] ?? emptyForm[k]])),
            departments: (p.departments || []).join(", "),
          });
        } else {
          setForm({
            ...emptyForm,
            full_name: localStorage.getItem("nc_signup_name") || "",
            phone: user?.mobile || "",
          });
        }
        setLoaded(true);
      })
      .catch((e) => setError(apiError(e)));
  }, [user]);

  useEffect(load, [load]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      experience_years: form.experience_years === "" ? "" : Number(form.experience_years),
      expected_salary: form.expected_salary === "" ? "" : Number(form.expected_salary),
      departments: form.departments.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (profile) {
        const { data } = await api.patch(`/nurse_profile/${profile.id}`, payload);
        setProfile(data);
      } else {
        const { data } = await api.post("/nurse_profile", { ...payload, verification_status: "pending" });
        setProfile(data);
      }
      toast.success("Profile saved");
    } catch (err) {
      toast.error(apiError(err, "Could not save profile"));
    } finally {
      setSaving(false);
    }
  };

  const uploadDoc = async (docType, file) => {
    if (file.size > MAX_FILE) { toast.error("File too large (max 2 MB)"); return; }
    setDocBusy(true);
    try {
      const data_base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const existing = docs.find((d) => d.doc_type === docType);
      const { data } = await api.post("/document", {
        doc_type: docType, file_name: file.name, file_size: file.size, content_type: file.type, data_base64,
      });
      if (existing) await api.delete(`/document/${existing.id}`).catch(() => {});
      setDocs((d) => [...d.filter((x) => x.doc_type !== docType), data]);
      toast.success("Document uploaded securely");
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
      setDocs((d) => d.filter((x) => x.id !== doc.id));
      toast.success("Document removed");
    } catch (err) {
      toast.error(apiError(err, "Could not delete document"));
    } finally {
      setDocBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!loaded) return <LoadingState label="Loading your profile..." />;

  const previewCompletion = profileCompletion({
    ...form,
    departments: form.departments.split(",").map((s) => s.trim()).filter(Boolean),
  });

  return (
    <div data-testid="nurse-profile-page" className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">My Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Keep your details up to date to improve your job matches</p>
        </div>
        <VerificationBadge status={profile?.verification_status} />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Profile completion</span>
          <span className="font-semibold text-slate-800">{previewCompletion}%</span>
        </div>
        <Progress value={previewCompletion} className="h-2" />
      </div>

      <form onSubmit={save} className="space-y-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id="full_name" label="Full name" value={form.full_name} onChange={set("full_name")} placeholder="e.g. Priya Sharma" />
            <Field id="email" label="Email" value={user?.email || ""} readOnly />
            <Field id="phone" label="Mobile number" value={form.phone} onChange={set("phone")} placeholder="e.g. +91 98765 43210" />
            <Field id="city" label="City" value={form.city} onChange={set("city")} placeholder="e.g. Mumbai" />
            <div className="space-y-1.5">
              <Label>State</Label>
              <Select value={form.state} onValueChange={set("state")}>
                <SelectTrigger data-testid="profile-state-select"><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent>
                  {(STATES.includes(form.state) || !form.state ? STATES : [form.state, ...STATES]).map((s) => (
                    <SelectItem key={s} data-testid={`state-option-${s.toLowerCase().replace(/\s+/g, "-")}`} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Professional Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id="qualification" label="Qualification" value={form.qualification} onChange={set("qualification")} placeholder="e.g. BSc Nursing" />
            <Field id="registration_number" label="Nursing registration number" value={form.registration_number} onChange={set("registration_number")} placeholder="e.g. MNC-123456" />
            <Field id="experience_years" label="Total experience (years)" type="number" value={form.experience_years} onChange={set("experience_years")} placeholder="e.g. 4" />
            <Field id="departments" label="Department experience (comma separated)" value={form.departments} onChange={set("departments")} placeholder="e.g. ICU, Emergency" />
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="preferred_location" label="Preferred location" value={form.preferred_location} onChange={set("preferred_location")} placeholder="e.g. Pune" />
              <Field id="expected_salary" label="Salary expectation (₹/month)" type="number" value={form.expected_salary} onChange={set("expected_salary")} placeholder="e.g. 45000" />
              <div className="space-y-1.5">
                <Label>Preferred shift</Label>
                <Select value={form.preferred_shift} onValueChange={set("preferred_shift")}>
                  <SelectTrigger data-testid="profile-preferred_shift-select"><SelectValue placeholder="Select shift" /></SelectTrigger>
                  <SelectContent>
                    {SHIFTS.map((s) => <SelectItem key={s} data-testid={`shift-option-${s.toLowerCase()}`} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <Label className="text-sm text-slate-600">Accommodation required</Label>
              <Switch data-testid="profile-accommodation-switch" checked={form.accommodation_required} onCheckedChange={set("accommodation_required")} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-slate-600">Willing to relocate</Label>
              <Switch data-testid="profile-relocate-switch" checked={form.willing_to_relocate} onCheckedChange={set("willing_to_relocate")} />
            </div>
          </CardContent>
        </Card>

        <Button data-testid="profile-save-btn" type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Profile
        </Button>
      </form>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Documents</CardTitle>
          <CardDescription>Private to you, authorized hospitals and admins. PDF/JPG/PNG up to 2 MB.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100">
          {DOC_TYPES.map((t) => (
            <DocumentRow key={t.key} type={t} doc={docs.find((d) => d.doc_type === t.key)} onUpload={uploadDoc} onDelete={deleteDoc} busy={docBusy} />
          ))}
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}
