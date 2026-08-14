import { useEffect, useState } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { LoadingState, ErrorState } from "../../components/nurse/States";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "sonner";

const SHIFTS = ["Day", "Night", "Rotational", "Flexible"];
const emptyForm = {
  title: "", department: "", openings: "1", qualification_required: "", experience_required: "",
  salary_min: "", salary_max: "", location: "", shift: "", accommodation: false,
  skills: "", description: "", application_deadline: "",
};

export default function JobForm() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { hospital } = useOutletContext();
  const [form, setForm] = useState(emptyForm);
  const [existing, setExisting] = useState(null);
  const [loaded, setLoaded] = useState(!jobId);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    api.get(`/job/${jobId}`)
      .then((r) => {
        setExisting(r.data);
        setForm({
          ...emptyForm,
          ...Object.fromEntries(Object.keys(emptyForm).map((k) => [k, r.data[k] ?? emptyForm[k]])),
          skills: Array.isArray(r.data.skills) ? r.data.skills.join(", ") : (r.data.skills || ""),
          accommodation: !!r.data.accommodation,
        });
        setLoaded(true);
      })
      .catch((e) => setError(apiError(e)));
  }, [jobId]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    if (!form.title.trim()) return "Job title is required";
    if (!form.department.trim()) return "Department is required";
    if (!form.location.trim()) return "Location is required";
    const openings = Number(form.openings);
    if (!Number.isInteger(openings) || openings < 1) return "Number of openings must be at least 1";
    if (form.experience_required !== "" && Number(form.experience_required) < 0) return "Experience cannot be negative";
    const smin = Number(form.salary_min), smax = Number(form.salary_max);
    if (form.salary_min === "" || form.salary_max === "") return "Salary minimum and maximum are required";
    if (smin <= 0 || smax <= 0) return "Salary values must be positive";
    if (smin > smax) return "Salary minimum cannot exceed salary maximum";
    if (form.application_deadline && form.application_deadline < new Date().toISOString().slice(0, 10)) return "Application deadline cannot be in the past";
    return null;
  };

  const save = async (publish) => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setBusy(true);
    const payload = {
      ...form,
      openings: Number(form.openings),
      experience_required: form.experience_required === "" ? 0 : Number(form.experience_required),
      salary_min: Number(form.salary_min),
      salary_max: Number(form.salary_max),
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      hospital_name: hospital?.name || "",
      hospital_verified: hospital?.verification_status === "verified",
      published: publish,
      approved: publish,
      status: publish ? "active" : "draft",
      updated_at: new Date().toISOString(),
    };
    try {
      if (existing) {
        await api.patch(`/job/${existing.id}`, payload);
        toast.success(publish ? "Job published" : "Draft saved");
      } else {
        await api.post("/job", payload);
        toast.success(publish ? "Job published" : "Draft saved");
      }
      navigate("/hospital/jobs");
    } catch (e) {
      toast.error(apiError(e, "Could not save job"));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={() => navigate("/hospital/jobs")} />;
  if (!loaded) return <LoadingState label="Loading job..." />;

  return (
    <div data-testid="job-form-page" className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button data-testid="job-form-back-btn" variant="ghost" size="icon" onClick={() => navigate("/hospital/jobs")}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">{existing ? "Edit Job" : "Create Job"}</h1>
          <p className="text-sm text-slate-500 mt-1">{existing ? "Update your job posting" : "Post a new position for nurses"}</p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader><CardTitle className="font-heading text-lg">Job Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            ["title", "Job title", "e.g. ICU Staff Nurse", "text"],
            ["department", "Department", "e.g. ICU", "text"],
            ["openings", "Number of openings", "e.g. 3", "number"],
            ["qualification_required", "Minimum qualification", "e.g. BSc Nursing", "text"],
            ["experience_required", "Required experience (years)", "e.g. 2", "number"],
            ["location", "Location", "e.g. Mumbai", "text"],
            ["salary_min", "Salary minimum (₹/month)", "e.g. 35000", "number"],
            ["salary_max", "Salary maximum (₹/month)", "e.g. 55000", "number"],
          ].map(([id, label, ph, type]) => (
            <div key={id} className="space-y-1.5">
              <Label htmlFor={`j-${id}`}>{label}</Label>
              <Input data-testid={`job-${id}-input`} id={`j-${id}`} type={type} min={type === "number" ? "0" : undefined} value={form[id]} placeholder={ph} onChange={(e) => set(id)(e.target.value)} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>Shift</Label>
            <Select value={form.shift} onValueChange={set("shift")}>
              <SelectTrigger data-testid="job-shift-select"><SelectValue placeholder="Select shift" /></SelectTrigger>
              <SelectContent>
                {SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="j-deadline">Application deadline</Label>
            <Input data-testid="job-application_deadline-input" id="j-deadline" type="date" min={new Date().toISOString().slice(0, 10)} value={form.application_deadline} onChange={(e) => set("application_deadline")(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="j-skills">Required skills (comma separated)</Label>
            <Input data-testid="job-skills-input" id="j-skills" value={form.skills} placeholder="e.g. Ventilator care, IV therapy" onChange={(e) => set("skills")(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="j-description">Job description</Label>
            <Textarea data-testid="job-description-input" id="j-description" rows={4} value={form.description} placeholder="Role responsibilities, benefits, requirements..." onChange={(e) => set("description")(e.target.value)} />
          </div>
          <div className="flex items-center justify-between sm:col-span-2 border-t border-slate-100 pt-4">
            <Label className="text-sm text-slate-600">Accommodation provided</Label>
            <Switch data-testid="job-accommodation-switch" checked={form.accommodation} onCheckedChange={set("accommodation")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button data-testid="job-save-draft-btn" variant="outline" disabled={busy} onClick={() => save(false)}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Draft
        </Button>
        <Button data-testid="job-submit-btn" disabled={busy} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => save(true)}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Submit &amp; Publish
        </Button>
      </div>
    </div>
  );
}
