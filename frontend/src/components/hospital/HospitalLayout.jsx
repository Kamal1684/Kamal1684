import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, Briefcase, Users, CalendarClock, UserCheck, LogOut, Menu, HeartPulse } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { NotificationsBell } from "../nurse/NotificationsBell";
import { VerificationBadge } from "../nurse/Badges";

const NAV = [
  { to: "/hospital/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { to: "/hospital/profile", label: "Hospital Profile", icon: Building2, id: "profile" },
  { to: "/hospital/jobs", label: "Jobs", icon: Briefcase, id: "jobs" },
  { to: "/hospital/candidates", label: "Applications", icon: Users, id: "candidates" },
  { to: "/hospital/interviews", label: "Interviews", icon: CalendarClock, id: "interviews" },
  { to: "/hospital/hired", label: "Hired Nurses", icon: UserCheck, id: "hired" },
];

const Brand = () => (
  <div className="flex items-center gap-2.5 px-1">
    <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center">
      <HeartPulse className="h-5 w-5 text-white" />
    </div>
    <div>
      <span className="font-heading font-extrabold text-lg text-slate-900 tracking-tight leading-none block">NurseConnect</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Hospital Console</span>
    </div>
  </div>
);

const NavLinks = ({ onNavigate, prefix = "hospital-sidebar" }) => (
  <nav className="flex-1 space-y-1 mt-6">
    {NAV.map(({ to, label, icon: Icon, id }) => (
      <NavLink key={to} to={to} onClick={onNavigate} data-testid={`${prefix}-nav-${id}`}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isActive ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}>
        <Icon className="h-[18px] w-[18px]" />
        {label}
      </NavLink>
    ))}
  </nav>
);

export default function HospitalLayout({ hospital, onRefresh }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = hospital?.name || user?.email?.split("@")[0] || "Hospital";
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 fixed inset-y-0">
        <Brand />
        <NavLinks />
        <Button data-testid="hospital-sidebar-logout-btn" variant="ghost" onClick={handleLogout} className="justify-start gap-3 text-slate-600 hover:text-red-600">
          <LogOut className="h-[18px] w-[18px]" /> Logout
        </Button>
      </aside>

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button data-testid="hospital-topbar-mobile-menu-btn" variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 px-4 py-6 flex flex-col">
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <Brand />
                <NavLinks prefix="hospital-mobile" onNavigate={() => setMobileOpen(false)} />
                <Button data-testid="hospital-mobile-logout-btn" variant="ghost" onClick={handleLogout} className="justify-start gap-3 text-slate-600 hover:text-red-600">
                  <LogOut className="h-[18px] w-[18px]" /> Logout
                </Button>
              </SheetContent>
            </Sheet>
            <span className="lg:hidden font-heading font-bold text-slate-900">NurseConnect</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:block"><VerificationBadge status={hospital?.verification_status} testId="hospital-verification-status-badge" /></div>
            <NotificationsBell role="hospital" />
            <div className="flex items-center gap-2.5" data-testid="hospital-topbar-user-info">
              <Avatar className="h-9 w-9 border border-slate-200">
                <AvatarFallback className="bg-emerald-600 text-white text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-tight" data-testid="hospital-topbar-name">{displayName}</p>
                <p className="text-xs text-slate-500">Hospital</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet context={{ hospital, refreshHospital: onRefresh }} />
        </main>
      </div>
    </div>
  );
}
