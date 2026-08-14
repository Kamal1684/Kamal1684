import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { HeartPulse, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";

export default function Login() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ email: "", password: "", account_type: "nurse" });

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
      afterAuth(await register(regForm.email, regForm.password, regForm.account_type));
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
            <CardDescription>Sign in or create your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger data-testid="login-tab" value="login">Sign In</TabsTrigger>
                <TabsTrigger data-testid="register-tab" value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
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
                </form>
              </TabsContent>
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input data-testid="register-email-input" id="reg-email" type="email" required value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password">Password (min 8 characters)</Label>
                    <Input data-testid="register-password-input" id="reg-password" type="password" required minLength={8} value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} placeholder="••••••••" />
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
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <p className="text-xs text-slate-400 text-center mt-6">Access is protected by server-side authorization.</p>
      </div>
    </div>
  );
}
