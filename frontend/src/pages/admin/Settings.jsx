import { ShieldCheck, KeyRound, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ChangePasswordCard } from "../../components/ChangePasswordCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

export default function AdminSettings() {
  const { user } = useAuth();
  return (
    <div data-testid="admin-settings-page" className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Administrator account and platform configuration</p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-indigo-600" /> Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Email</dt>
              <dd data-testid="settings-admin-email" className="font-medium text-slate-800">{user?.email}</dd>
            </div>
            <div className="flex justify-between gap-4 items-center">
              <dt className="text-slate-500">Role</dt>
              <dd><Badge data-testid="settings-admin-role" variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Administrator (server-verified)</Badge></dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <ChangePasswordCard accentClass="bg-indigo-600 hover:bg-indigo-700" />

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2"><KeyRound className="h-5 w-5 text-indigo-600" /> Admin Provisioning</CardTitle>
          <CardDescription>How new administrators are created</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>Admin access is granted exclusively through the server-side bootstrap endpoint, which requires the <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">ADMIN_BOOTSTRAP_SECRET</span> held only in the backend environment.</p>
          <p>Client-side role fields, account types and any frontend flags are never trusted for authorization.</p>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-600" /> Matching &amp; Alerts</CardTitle>
          <CardDescription>Rule-based job matching configuration</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>Job alerts are generated server-side when a job goes live, for nurses with a match score <span className="font-semibold text-slate-800">above 75%</span>.</p>
          <p>Weights: Department 25 · Location 20 · Experience 20 · Shift 15 · Qualification 10 · Salary 10.</p>
        </CardContent>
      </Card>
    </div>
  );
}
