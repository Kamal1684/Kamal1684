import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { HeartPulse, Loader2, MailCheck, ArrowLeft } from "lucide-react";
import api, { apiError } from "../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { toast } from "sonner";

const Shell = ({ children }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
    <div className="w-full max-w-md">
      <div className="flex items-center justify-center gap-2.5 mb-8">
        <div className="h-11 w-11 rounded-xl bg-blue-600 flex items-center justify-center">
          <HeartPulse className="h-6 w-6 text-white" />
        </div>
        <span className="font-heading font-extrabold text-2xl text-slate-900">NurseConnect</span>
      </div>
      {children}
    </div>
  </div>
);

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      toast.error(apiError(err, "Could not process the request"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading">Forgot Password</CardTitle>
          <CardDescription>Enter your account email and we'll send reset instructions.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div data-testid="forgot-password-success" className="text-center py-4 space-y-3">
              <MailCheck className="h-10 w-10 text-emerald-600 mx-auto" />
              <p className="text-sm text-slate-600">If an account exists for that email, password reset instructions have been sent.</p>
              <Button asChild variant="outline" size="sm" data-testid="forgot-back-to-login-btn">
                <Link to="/login"><ArrowLeft className="h-4 w-4 mr-2" /> Back to login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fp-email">Email</Label>
                <Input data-testid="forgot-password-email-input" id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <Button data-testid="forgot-password-submit-btn" type="submit" disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Send Reset Instructions
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-full" data-testid="forgot-cancel-btn">
                <Link to="/login">Back to login</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const [form, setForm] = useState({ next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.next.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (form.next !== form.confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: form.next });
      toast.success("Password reset. Please sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(apiError(err, "Could not reset password"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading">Set a New Password</CardTitle>
          <CardDescription>Reset links are valid for 30 minutes and can be used once.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p data-testid="reset-missing-token" className="text-sm text-slate-600">
              This page needs a valid reset link. <Link className="text-blue-600 hover:underline" to="/forgot-password">Request a new one</Link>.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="rp-new">New password (min 8 characters)</Label>
                <Input data-testid="reset-new-password-input" id="rp-new" type="password" required minLength={8} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-confirm">Confirm new password</Label>
                <Input data-testid="reset-confirm-password-input" id="rp-confirm" type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" />
              </div>
              <Button data-testid="reset-password-submit-btn" type="submit" disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Reset Password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}
