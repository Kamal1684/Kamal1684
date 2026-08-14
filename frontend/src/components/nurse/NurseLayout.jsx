import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, UserRound, Search, Bookmark, FileText, CalendarClock, LogOut, Menu, HeartPulse } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { NotificationsBell } from "./NotificationsBell";

const NAV = [
  { to: "/nurse/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { to: "/nurse/profile", label: "My Profile", icon: UserRound, id: "profile" },
  { to: "/nurse/jobs", label: "Find Jobs", icon: Search, id: "find-jobs" },
  { to: "/nurse/saved-jobs", label: "Saved Jobs", icon: Bookmark, id: "saved-jobs" },
  { to: "/nurse/applications", label: "Applications", icon: FileText, id: "applications" },
  { to: "/nurse/interviews", label: "Interviews", icon: CalendarClock, id: "interviews" },
];

const Brand = () => (
  <div className="flex items-center gap-2.5 px-1">
    <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
      <HeartPulse className="h-5 w-5 text-white" />
    </div>
    <span className="font-heading font-extrabold text-lg text-slate-900 tracking-tight">NurseConnect</span>
  </div>
);

const NavLinks = ({ onNavigate, prefix = "sidebar" }) => (
  <nav className="flex-1 space-y-1 mt-6">
    {NAV.map(({ to, label, icon: Icon, id }) => (
      <NavLink
        key={to}
        to={to}
        onClick={onNavigate}
        data-testid={`${prefix}-nav-${id}`}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`
        }
      >
        <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        {label}
      </NavLink>
    ))}
  </nav>
);

export default function NurseLayout({ nurseName }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = nurseName || user?.email?.split("@")[0] || "Nurse";
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
        <Button data-testid="sidebar-logout-btn" variant="ghost" onClick={handleLogout} className="justify-start gap-3 text-slate-600 hover:text-red-600">
          <LogOut className="h-[18px] w-[18px]" /> Logout
        </Button>
      </aside>

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button data-testid="topbar-mobile-menu-btn" variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 px-4 py-6 flex flex-col">
                <Brand />
                <NavLinks prefix="mobile" onNavigate={() => setMobileOpen(false)} />
                <Button data-testid="mobile-logout-btn" variant="ghost" onClick={handleLogout} className="justify-start gap-3 text-slate-600 hover:text-red-600">
                  <LogOut className="h-[18px] w-[18px]" /> Logout
                </Button>
              </SheetContent>
            </Sheet>
            <span className="lg:hidden font-heading font-bold text-slate-900">NurseConnect</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <NotificationsBell />
            <div className="flex items-center gap-2.5" data-testid="topbar-user-info">
              <Avatar className="h-9 w-9 border border-slate-200">
                <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-tight" data-testid="topbar-nurse-name">{displayName}</p>
                <p className="text-xs text-slate-500">Nurse</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
