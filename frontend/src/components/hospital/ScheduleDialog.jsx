import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import api, { apiError } from "../../lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";

const TYPES = ["Video", "In-Person", "Phone"];
const empty = { date: "", time: "", interview_type: "Video", meeting_link: "", location: "", notes: "" };

export function ScheduleDialog({ open, onClose, application, interview, onDone }) {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const isReschedule = !!interview;

  useEffect(() => {
    if (open) {
      setForm(interview
        ? { date: interview.date || "", time: interview.time || "", interview_type: interview.interview_type || "Video", meeting_link: interview.meeting_link || "", location: interview.location || "", notes: interview.notes || "" }
        : empty);
    }
  }, [open, interview]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const nurseName = interview?.nurse_name || application?.nurse_name || "Candidate";
  const jobTitle = interview?.job_title || application?.job_title || "Job";

  const submit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.time) { toast.error("Date and time are required"); return; }
    const today = new Date().toISOString().slice(0, 10);
    if (form.date < today) { toast.error("Interview date cannot be in the past"); return; }
    if (form.interview_type === "Video" && !form.meeting_link.trim()) { toast.error("Meeting link is required for video interviews"); return; }
    if (form.interview_type === "In-Person" && !form.location.trim()) { toast.error("Location is required for in-person interviews"); return; }
    setBusy(true);
    try {
      if (isReschedule) {
        await api.patch(`/interview/${interview.id}`, { ...form, status: "scheduled", updated_at: new Date().toISOString() });
        toast.success("Interview rescheduled");
      } else {
        await api.post("/interview", {
          application_id: application.id, ...form, status: "scheduled",
          nurse_name: application.nurse_name, job_title: application.job_title, hospital_name: application.hospital_name,
        });
        await api.patch(`/application/${application.id}`, { status: "interview_scheduled", updated_at: new Date().toISOString() });
        toast.success("Interview scheduled");
      }
      onDone();
      onClose();
    } catch (err) {
      toast.error(apiError(err, "Could not schedule interview"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="schedule-interview-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">{isReschedule ? "Reschedule Interview" : "Schedule Interview"}</DialogTitle>
          <DialogDescription>{nurseName} · {jobTitle}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input data-testid="interview-date-input" type="date" required value={form.date} onChange={(e) => set("date")(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input data-testid="interview-time-input" type="time" required value={form.time} onChange={(e) => set("time")(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Interview type</Label>
            <Select value={form.interview_type} onValueChange={set("interview_type")}>
              <SelectTrigger data-testid="interview-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} data-testid={`interview-type-${t.toLowerCase()}`} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.interview_type === "Video" ? (
            <div className="space-y-1.5">
              <Label>Meeting link</Label>
              <Input data-testid="interview-meeting-link-input" type="url" placeholder="https://meet.example.com/..." value={form.meeting_link} onChange={(e) => set("meeting_link")(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input data-testid="interview-location-input" placeholder="e.g. HR office, 2nd floor" value={form.location} onChange={(e) => set("location")(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea data-testid="interview-notes-input" rows={2} placeholder="Instructions for the candidate" value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
          </div>
          <Button data-testid="interview-schedule-submit-btn" type="submit" disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {isReschedule ? "Save New Schedule" : "Schedule Interview"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
