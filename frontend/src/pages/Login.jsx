import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { HeartPulse, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";

export default function Login() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("login");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ full_name: "", email: "", password: "", account_type: "nurse", mobile: "" });

  const homeFor = (u) => u.is_admin ? "/admin/dashboard" : u.account_type === "nurse" ? "/nurse/dashboard" : u.account_type === "hospital" ? "/hospital/dashboard" : "/";

  if (!loading && user) return <Navigate to={homeFor(user)} replace />;

  const afterAuth = (u) => {
    toast.success("Welcome to NurseConnect");
    navigate(homeFor(u), { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      afterAuth(await login(loginForm.email, loginForm.password));    } catch (err) {
      toast.error(apiError(err, "Login failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      localStorage.setItem("nc_signup_name", regForm.full_name.trim());
      afterAuth(await register(regForm.email, regForm.password, regForm.account_type, regForm.mobile));
    } catch (err) {
      toast.error(apiError(err, "Registration failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-11 w-11 rounded-xl bg-blue-600 flex items-center justify-center">
            <HeartPulse className="h-6 w-6 text-white" />
          </div>
          <span className="font-heading font-extrabold text-2xl text-slate-900">NurseConnect</span>
        </div>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading">Welcome</CardTitle>
            <CardDescription>{mode === "login" ? "Sign in to continue to your account" : "Create your account to get started"}</CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <Input data-testid="login-email-input" id="login-email" type="email" required value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="you@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <Input data-testid="login-password-input" id="login-password" type="password" required value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="••••••••" />
                </div>
                <Button data-testid="login-submit-btn" type="submit" disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700">
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Sign In
                </Button>
                <div className="text-center">
                  <Link data-testid="forgot-password-link" to="/forgot-password" className="text-sm text-blue-600 hover:underline">Forgot password?</Link>
                </div>
                <div className="pt-4 mt-2 border-t border-slate-100 text-center text-sm text-slate-500">
                  Don't have an account?{" "}
                  <button data-testid="switch-to-register-btn" type="button" onClick={() => setMode("register")} className="font-medium text-blue-600 hover:underline">Register</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">Full Name</Label>
                  <Input data-testid="register-name-input" id="reg-name" type="text" required value={regForm.full_name} onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })} placeholder="e.g. Priya Sharma" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input data-testid="register-email-input" id="reg-email" type="email" required value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} placeholder="you@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password">Password (min 8 characters)</Label>
                  <div className="relative">
                    <Input data-testid="register-password-input" id="reg-password" type={showRegPassword ? "text" : "password"} required minLength={8} value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} placeholder="••••••••" className="pr-10" />
                    <button type="button" data-testid="toggle-register-password" aria-label={showRegPassword ? "Hide password" : "Show password"} onClick={() => setShowRegPassword((v) => !v)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600">
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-mobile">Mobile Number</Label>
                  <Input data-testid="register-mobile-input" id="reg-mobile" type="tel" inputMode="numeric" required value={regForm.mobile} onChange={(e) => setRegForm({ ...regForm, mobile: e.target.value })} placeholder="+91 10-digit mobile number" />
                  <p data-testid="mobile-verification-note" className="text-xs text-amber-600">Verification pending — we'll verify your number later.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>I am a</Label>
                  <Select value={regForm.account_type} onValueChange={(v) => setRegForm({ ...regForm, account_type: v })}>
                    <SelectTrigger data-testid="register-account-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem data-testid="account-type-nurse" value="nurse">Nurse</SelectItem>
                      <SelectItem data-testid="account-type-hospital" value="hospital">Hospital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button data-testid="register-submit-btn" type="submit" disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700">
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Account
                </Button>
                <div className="pt-4 mt-2 border-t border-slate-100 text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <button data-testid="switch-to-login-btn" type="button" onClick={() => setMode("login")} className="font-medium text-blue-600 hover:underline">Sign In</button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-slate-400 text-center mt-6">Access is protected by server-side authorization.</p>
      </div>
    </div>
  );
}
