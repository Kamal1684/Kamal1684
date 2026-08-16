import { useState, type ReactNode } from 'react';
import { Activity, LogOut, Menu, X, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn, getInitials } from '@/lib/utils';

type NavItem = {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
};

type DashboardShellProps = {
  navItems: NavItem[];
  children: ReactNode;
  title: string;
  subtitle?: string;
};

export function DashboardShell({ navItems, children, title, subtitle }: DashboardShellProps) {
  const { profile, signOut } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const roleLabel = profile?.role === 'nurse' ? 'Nurse' : profile?.role === 'hospital' ? 'Hospital' : 'Administrator';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-slate-900">NurseConnect</div>
                <div className="text-xs text-slate-500">{roleLabel} Portal</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                {profile?.full_name ? getInitials(profile.full_name) : <UserIcon className="h-4 w-4" />}
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-slate-800">{profile?.full_name}</div>
                <div className="text-xs text-slate-500">{profile?.email}</div>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar nav — desktop */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-slate-200 bg-white py-6 lg:block">
          <nav className="space-y-1 px-3">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  item.active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Sidebar nav — mobile drawer */}
        {mobileNavOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] w-64 border-r border-slate-200 bg-white py-6 lg:hidden animate-slide-in">
              <nav className="space-y-1 px-3">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      item.onClick();
                      setMobileNavOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      item.active
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </nav>
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
