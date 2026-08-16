import { useState } from 'react';
import { Activity, ArrowRight, ArrowLeft, Building2, HeartPulse, Shield, CheckCircle2, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/supabase';
import { Button, Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

export function AuthPage({ initialMode = 'login' }: { initialMode?: AuthMode }) {
  const { signIn, signUp, resetPasswordForEmail, updateUserPassword, clearPasswordRecovery } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('nurse');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === 'login') {
      const { error: err } = await signIn(email, password);
      if (err) setError(err);
    } else if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const { error: err } = await signUp(email, password, fullName, role);
      if (err) setError(err);
    } else if (mode === 'forgot') {
      const { error: err } = await resetPasswordForEmail(email);
      if (err) {
        setError(err);
      } else {
        setSuccess('Password reset link sent! Check your email inbox for instructions to reset your password.');
      }
    } else if (mode === 'reset') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
      const { error: err } = await updateUserPassword(password);
      if (err) {
        setError(err);
      } else {
        setSuccess('Password updated successfully! You can now sign in with your new password.');
        clearPasswordRecovery();
      }
    }

    setLoading(false);
  }

  const titles: Record<AuthMode, string> = {
    login: 'Welcome back',
    signup: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Set a new password',
  };

  const subtitles: Record<AuthMode, string> = {
    login: 'Sign in to access your dashboard',
    signup: 'Join NurseConnect as a nurse or hospital',
    forgot: 'Enter your email and we\'ll send you a reset link',
    reset: 'Choose a new password for your account',
  };

  const buttonLabels: Record<AuthMode, string> = {
    login: 'Sign in',
    signup: 'Create account',
    forgot: 'Send reset link',
    reset: 'Update password',
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary-700 p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary-400/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Activity className="h-6 w-6" />
            </div>
            <span className="text-xl font-semibold tracking-tight">NurseConnect</span>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Connecting nurses with hospitals, one shift at a time.
            </h1>
            <p className="mt-4 text-lg text-primary-100">
              A streamlined platform for healthcare staffing — browse open shifts, apply instantly, and manage your workforce.
            </p>
          </div>

          <div className="space-y-4">
            <FeatureRow icon={<HeartPulse className="h-5 w-5" />} title="For Nurses" desc="Find flexible shifts that match your specialty and schedule" />
            <FeatureRow icon={<Building2 className="h-5 w-5" />} title="For Hospitals" desc="Post shifts, review applicants, and fill positions fast" />
            <FeatureRow icon={<Shield className="h-5 w-5" />} title="Secure & Verified" desc="Every professional is credentialed and verified" />
          </div>
        </div>

        <div className="relative text-sm text-primary-200">
          Trusted by healthcare networks nationwide
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex min-h-screen items-center justify-center p-6 lg:min-h-0">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-slate-900">NurseConnect</span>
          </div>

          {(mode === 'forgot' || mode === 'reset') && (
            <button
              onClick={() => switchMode('login')}
              className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </button>
          )}

          <h2 className="text-2xl font-bold text-slate-900">{titles[mode]}</h2>
          <p className="mt-1.5 text-sm text-slate-500">{subtitles[mode]}</p>

          {success ? (
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700 animate-scale-in">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{success}</span>
              </div>
              {mode === 'reset' ? (
                <Button fullWidth size="lg" onClick={() => switchMode('login')}>
                  Go to sign in
                </Button>
              ) : (
                <Button fullWidth size="lg" variant="outline" onClick={() => switchMode('login')}>
                  Back to sign in
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {mode === 'signup' && (
                <Input
                  label="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                />
              )}

              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />

              {mode === 'login' && (
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                />
              )}

              {mode === 'signup' && (
                <>
                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                  />
                  <Select label="I am a..." value={role} onChange={(e) => setRole(e.target.value as UserRole)} required>
                    <option value="nurse">Nurse — looking for shifts</option>
                    <option value="hospital">Hospital — posting shifts</option>
                  </Select>
                </>
              )}

              {mode === 'forgot' && (
                <div className="flex items-start gap-2 rounded-lg bg-primary-50 border border-primary-100 px-3.5 py-3 text-xs text-primary-700">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>We'll send a password reset link to this email address. Click the link in the email to set a new password.</span>
                </div>
              )}

              {mode === 'reset' && (
                <>
                  <Input
                    label="New password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    required
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-600">Passwords do not match</p>
                  )}
                </>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-scale-in">
                  {error}
                </div>
              )}

              <Button type="submit" fullWidth size="lg" disabled={loading}>
                {loading ? 'Please wait...' : buttonLabels[mode]}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          )}

          {/* Footer links */}
          {!success && (
            <div className="mt-6 space-y-2 text-center text-sm text-slate-500">
              {mode === 'login' && (
                <>
                  <button
                    onClick={() => switchMode('forgot')}
                    className="block w-full font-medium text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    Forgot password?
                  </button>
                  <span>
                    Don't have an account?{' '}
                    <button
                      onClick={() => switchMode('signup')}
                      className={cn('font-medium text-primary-600 hover:text-primary-700')}
                    >
                      Sign up
                    </button>
                  </span>
                </>
              )}
              {mode === 'signup' && (
                <span>
                  Already have an account?{' '}
                  <button
                    onClick={() => switchMode('login')}
                    className={cn('font-medium text-primary-600 hover:text-primary-700')}
                  >
                    Sign in
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
        {icon}
      </div>
      <div>
        <div className="font-medium text-white">{title}</div>
        <div className="text-sm text-primary-200">{desc}</div>
      </div>
    </div>
  );
}
