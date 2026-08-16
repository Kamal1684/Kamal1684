import { useState, Component, type ReactNode } from 'react';
import {
  Briefcase, FileText, User as UserIcon, Building2, LayoutDashboard,
  Users, ClipboardList, Bookmark, Video, Bell, Award, Stethoscope,
  ShieldCheck, CheckCircle2, XCircle, Activity,
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthPage } from '@/components/AuthPage';
import { DashboardShell } from '@/components/DashboardShell';
import { NursePortal } from '@/components/NursePortal';
import { HospitalPortal } from '@/components/HospitalPortal';
import { AdminPortal } from '@/components/AdminPortal';
import { Spinner, ToastProvider } from '@/components/ui';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
            <p className="mt-2 text-sm text-slate-500">
              The application encountered an unexpected error. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type NurseTab = 'browse' | 'applications' | 'saved' | 'interviews' | 'profile' | 'documents' | 'notifications';
type HospitalTab = 'jobs' | 'applications' | 'interviews' | 'profile' | 'documents' | 'notifications';
type AdminTab = 'overview' | 'users' | 'jobs' | 'applications' | 'verifications' | 'activity';

function AppContent() {
  const { user, profile, loading, signOut, isPasswordRecovery } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  if (!user || !profile) {
    if (isPasswordRecovery) {
      return <AuthPage initialMode="reset" />;
    }
    return <AuthPage />;
  }

  if (isPasswordRecovery) {
    return <AuthPage initialMode="reset" />;
  }

  if (profile.role === 'nurse') return <NurseDashboard />;
  if (profile.role === 'hospital') return <HospitalDashboard />;
  if (profile.role === 'admin') return <AdminDashboard />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold text-slate-900">Account not recognized</h2>
        <p className="mt-2 text-sm text-slate-500">
          Your account role is not set up correctly. Please contact support.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function NurseDashboard() {
  const [tab, setTab] = useState<NurseTab>('browse');

  const navItems = [
    { label: 'Browse Jobs', icon: <Briefcase className="h-4.5 w-4.5" />, active: tab === 'browse', onClick: () => setTab('browse') },
    { label: 'My Applications', icon: <FileText className="h-4.5 w-4.5" />, active: tab === 'applications', onClick: () => setTab('applications') },
    { label: 'Saved Jobs', icon: <Bookmark className="h-4.5 w-4.5" />, active: tab === 'saved', onClick: () => setTab('saved') },
    { label: 'Interviews', icon: <Video className="h-4.5 w-4.5" />, active: tab === 'interviews', onClick: () => setTab('interviews') },
    { label: 'My Profile', icon: <UserIcon className="h-4.5 w-4.5" />, active: tab === 'profile', onClick: () => setTab('profile') },
    { label: 'Documents', icon: <FileText className="h-4.5 w-4.5" />, active: tab === 'documents', onClick: () => setTab('documents') },
    { label: 'Notifications', icon: <Bell className="h-4.5 w-4.5" />, active: tab === 'notifications', onClick: () => setTab('notifications') },
  ];

  const titles: Record<NurseTab, { title: string; subtitle: string }> = {
    browse: { title: 'Browse Jobs', subtitle: 'Find and apply to open nursing positions' },
    applications: { title: 'My Applications', subtitle: 'Track the status of your job applications' },
    saved: { title: 'Saved Jobs', subtitle: 'Jobs you have bookmarked for later' },
    interviews: { title: 'My Interviews', subtitle: 'Upcoming and past interview schedules' },
    profile: { title: 'My Profile', subtitle: 'Update your professional information and credentials' },
    documents: { title: 'My Documents', subtitle: 'Upload and manage your certificates and credentials' },
    notifications: { title: 'Notifications', subtitle: 'Updates about your applications and interviews' },
  };

  return (
    <DashboardShell navItems={navItems} title={titles[tab].title} subtitle={titles[tab].subtitle}>
      <NursePortal tab={tab} setTab={setTab} />
    </DashboardShell>
  );
}

function HospitalDashboard() {
  const [tab, setTab] = useState<HospitalTab>('jobs');

  const navItems = [
    { label: 'Manage Jobs', icon: <Briefcase className="h-4.5 w-4.5" />, active: tab === 'jobs', onClick: () => setTab('jobs') },
    { label: 'Applications', icon: <ClipboardList className="h-4.5 w-4.5" />, active: tab === 'applications', onClick: () => setTab('applications') },
    { label: 'Interviews', icon: <Video className="h-4.5 w-4.5" />, active: tab === 'interviews', onClick: () => setTab('interviews') },
    { label: 'Hospital Profile', icon: <Building2 className="h-4.5 w-4.5" />, active: tab === 'profile', onClick: () => setTab('profile') },
    { label: 'Documents', icon: <FileText className="h-4.5 w-4.5" />, active: tab === 'documents', onClick: () => setTab('documents') },
    { label: 'Notifications', icon: <Bell className="h-4.5 w-4.5" />, active: tab === 'notifications', onClick: () => setTab('notifications') },
  ];

  const titles: Record<HospitalTab, { title: string; subtitle: string }> = {
    jobs: { title: 'Manage Jobs', subtitle: 'Post new positions and manage your existing job listings' },
    applications: { title: 'Review Applications', subtitle: 'Shortlist or decline nurses applying for your jobs' },
    interviews: { title: 'Interviews', subtitle: 'Schedule and track interviews with candidates' },
    profile: { title: 'Hospital Profile', subtitle: 'Update your hospital information visible to nurses' },
    documents: { title: 'Documents', subtitle: 'Upload verification documents for your hospital' },
    notifications: { title: 'Notifications', subtitle: 'Updates about job approvals and applications' },
  };

  return (
    <DashboardShell navItems={navItems} title={titles[tab].title} subtitle={titles[tab].subtitle}>
      <HospitalPortal tab={tab} setTab={setTab} />
    </DashboardShell>
  );
}

function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>('overview');

  const navItems = [
    { label: 'Overview', icon: <LayoutDashboard className="h-4.5 w-4.5" />, active: tab === 'overview', onClick: () => setTab('overview') },
    { label: 'Users', icon: <Users className="h-4.5 w-4.5" />, active: tab === 'users', onClick: () => setTab('users') },
    { label: 'Jobs', icon: <Briefcase className="h-4.5 w-4.5" />, active: tab === 'jobs', onClick: () => setTab('jobs') },
    { label: 'Applications', icon: <FileText className="h-4.5 w-4.5" />, active: tab === 'applications', onClick: () => setTab('applications') },
    { label: 'Verifications', icon: <ShieldCheck className="h-4.5 w-4.5" />, active: tab === 'verifications', onClick: () => setTab('verifications') },
    { label: 'Activity', icon: <Activity className="h-4.5 w-4.5" />, active: tab === 'activity', onClick: () => setTab('activity') },
  ];

  const titles: Record<AdminTab, { title: string; subtitle: string }> = {
    overview: { title: 'Admin Dashboard', subtitle: 'Platform-wide overview and key metrics' },
    users: { title: 'User Management', subtitle: 'View all registered nurses and hospitals' },
    jobs: { title: 'Job Approvals', subtitle: 'Approve or reject pending job postings' },
    applications: { title: 'All Applications', subtitle: 'Track all nurse applications platform-wide' },
    verifications: { title: 'Verifications', subtitle: 'Verify nurse and hospital accounts' },
    activity: { title: 'Recent Activity', subtitle: 'Latest actions across the platform' },
  };

  return (
    <DashboardShell navItems={navItems} title={titles[tab].title} subtitle={titles[tab].subtitle}>
      <AdminPortal tab={tab} />
    </DashboardShell>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
