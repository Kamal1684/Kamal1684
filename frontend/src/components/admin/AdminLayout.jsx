import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, UserRound, Building2, Briefcase, FileText, ShieldCheck, Settings, LogOut, Menu, HeartPulse, Bell, ClipboardList } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";
import { jobState } from "../../lib/status";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "../ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { to: "/admin/nurses", label: "Nurses", icon: UserRound, id: "nurses" },
  { to: "/admin/hospitals", label: "Hospitals", icon: Building2, id: "hospitals" },
  { to: "/admin/jobs", label: "Job Approvals", icon: Briefcase, id: "jobs" },
  { to: "/admin/applications", label: "Applications", icon: FileText, id: "applications" },
  { to: "/admin/verification", label: "Verification", icon: ShieldCheck, id: "verification" },
  { to: "/admin/reports", label: "Selected/Joined", icon: ClipboardList, id: "reports" },
  { to: "/admin/settings", label: "Settings", icon: Settings, id: "settings" },
];

const PENDING = new Set(["pending", "under_review"]);

const Brand = () => (
  <div className="flex items-center gap-2.5 px-1">
    <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center">
      <HeartPulse className="h-5 w-5 text-white" />
    </div>
    <div>
      <span className="font-heading font-extrabold text-lg text-slate-900 tracking-tight leading-none block">NurseConnect</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700">Admin Console</span>
    </div>
  </div>
);

const NavLinks = ({ onNavigate, prefix = "admin-sidebar" }) => (
  <nav className="flex-1 space-y-1 mt-6">
    {NAV.map(({ to, label, icon: Icon, id }) => (
      <NavLink key={to} to={to} onClick={onNavigate} data-testid={`${prefix}-nav-${id}`}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}>
        <Icon className="h-[18px] w-[18px]" />
        {label}
      </NavLink>
    ))}
  </nav>
);

function AdminBell() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    Promise.all([api.get("/nurse_profile"), api.get("/hospital"), api.get("/job")])
      .then(([np, h, j]) => {
        const list = [];
        const pn = (np.data || []).filter((x) => PENDING.has(x.verification_status || "pending")).length;
        const ph = (h.data || []).filter((x) => PENDING.has(x.verification_status || "pending")).length;
        const pj = (j.data || []).filter((x) => jobState(x) === "pending_approval").length;
        if (pn) list.push(`${pn} nurse${pn === 1 ? "" : "s"} awaiting verification`);
        if (ph) list.push(`${ph} hospital${ph === 1 ? "" : "s"} awaiting verification`);
        if (pj) list.push(`${pj} job${pj === 1 ? "" : "s"} awaiting approval`);
        setItems(list);
      })
      .catch(() => setItems([]));
  }, []);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button data-testid="admin-notifications-btn" variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-600" />
          {items.length > 0 && (
            <span data-testid="admin-notifications-count-badge" className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">{items.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm text-slate-800">Pending actions</div>
        {items.length === 0 ? (
          <p data-testid="admin-notifications-empty" className="px-4 py-6 text-sm text-slate-500 text-center">Nothing pending. All caught up.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((t, i) => (
              <li key={i} className="px-4 py-3 flex items-start gap-3 text-sm text-slate-600">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-indigo-600 shrink-0" /> {t}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = user?.email?.split("@")[0] || "Admin";
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 fixed inset-y-0">
        <Brand />
        <NavLinks />
        <Button data-testid="admin-sidebar-logout-btn" variant="ghost" onClick={handleLogout} className="justify-start gap-3 text-slate-600 hover:text-red-600">
          <LogOut className="h-[18px] w-[18px]" /> Logout
        </Button>
      </aside>

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button data-testid="admin-topbar-mobile-menu-btn" variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 px-4 py-6 flex flex-col">
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <Brand />
                <NavLinks prefix="admin-mobile" onNavigate={() => setMobileOpen(false)} />
                <Button data-testid="admin-mobile-logout-btn" variant="ghost" onClick={handleLogout} className="justify-start gap-3 text-slate-600 hover:text-red-600">
                  <LogOut className="h-[18px] w-[18px]" /> Logout
                </Button>
              </SheetContent>
            </Sheet>
            <span className="lg:hidden font-heading font-bold text-slate-900">NurseConnect</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <AdminBell />
            <div className="flex items-center gap-2.5" data-testid="admin-topbar-user-info">
              <Avatar className="h-9 w-9 border border-slate-200">
                <AvatarFallback className="bg-indigo-600 text-white text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-tight" data-testid="admin-topbar-name">{displayName}</p>
                <p className="text-xs text-slate-500">Administrator</p>
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
