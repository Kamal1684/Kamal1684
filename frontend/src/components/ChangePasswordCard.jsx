import { useState } from "react";
import { Loader2, KeyRound } from "lucide-react";
import api, { apiError } from "../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { toast } from "sonner";

export function ChangePasswordCard({ accentClass = "bg-blue-600 hover:bg-blue-700" }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.next.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (form.next !== form.confirm) { toast.error("New password and confirmation do not match"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/auth/change-password", { current_password: form.current, new_password: form.next });
      if (data.token) localStorage.setItem("nc_token", data.token);
      setForm({ current: "", next: "", confirm: "" });
      toast.success("Password changed successfully");
    } catch (err) {
      toast.error(apiError(err, "Could not change password"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-slate-200" data-testid="change-password-card">
      <CardHeader>
        <CardTitle className="font-heading text-lg flex items-center gap-2"><KeyRound className="h-5 w-5 text-slate-500" /> Security — Change Password</CardTitle>
        <CardDescription>Changing your password signs out all other active sessions.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="cp-current">Current password</Label>
            <Input data-testid="current-password-input" id="cp-current" type="password" required value={form.current} onChange={set("current")} autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">New password (min 8 characters)</Label>
            <Input data-testid="new-password-input" id="cp-new" type="password" required minLength={8} value={form.next} onChange={set("next")} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Confirm new password</Label>
            <Input data-testid="confirm-password-input" id="cp-confirm" type="password" required value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
            {form.confirm && form.next !== form.confirm && (
              <p data-testid="password-mismatch-message" className="text-xs text-red-600">Passwords do not match</p>
            )}
          </div>
          <Button data-testid="change-password-submit-btn" type="submit" disabled={busy} className={accentClass}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
