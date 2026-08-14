import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarClock, FileText, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import api from "../../lib/api";
import { appStatusMeta, fmtDate } from "../../lib/status";

export function NotificationsBell({ role = "nurse" }) {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const calls = [api.get("/interview"), api.get("/application")];
    if (role === "nurse") calls.push(api.get("/alerts"));
    Promise.all(calls)
      .then(([iv, apps, al]) => {
        const today = new Date().toISOString().slice(0, 10);
        const upcoming = (iv.data || [])
          .filter((i) => (i.date || "") >= today && i.status !== "cancelled")
          .map((i) => ({ type: "interview", text: role === "hospital"
            ? `Interview${i.nurse_name ? ` with ${i.nurse_name}` : ""} on ${fmtDate(i.date)}${i.time ? ` at ${i.time}` : ""}`
            : `Interview ${i.job_title ? `for ${i.job_title} ` : ""}on ${fmtDate(i.date)}${i.time ? ` at ${i.time}` : ""}`, icon: CalendarClock }));
        const updates = role === "hospital"
          ? (apps.data || [])
              .filter((a) => a.status === "submitted")
              .map((a) => ({ type: "application", text: `New application${a.nurse_name ? ` from ${a.nurse_name}` : ""}${a.job_title ? ` for ${a.job_title}` : ""}`, icon: FileText }))
          : (apps.data || [])
              .filter((a) => a.status && a.status !== "submitted")
              .map((a) => ({ type: "application", text: `Application ${a.job_title ? `for ${a.job_title} ` : ""}is now ${appStatusMeta(a.status).label}`, icon: FileText }));
        setAlerts(al?.data || []);
        setItems([...upcoming, ...updates].slice(0, 8));
      })
      .catch(() => { setItems([]); setAlerts([]); });
  }, [role]);

  const unread = alerts.filter((a) => !a.read).length;
  const badgeCount = unread + items.length;

  const onOpenChange = (open) => {
    if (open && unread > 0) {
      api.post("/alerts/mark-read").catch(() => {});
      setAlerts((as) => as.map((a) => ({ ...a, read: true })));
    }
  };

  const total = alerts.length + items.length;

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button data-testid="topbar-notifications-btn" variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-600" />
          {badgeCount > 0 && (
            <span data-testid="notifications-count-badge" className={`absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${unread > 0 ? "bg-emerald-600" : "bg-blue-600"}`}>
              {badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm text-slate-800">Notifications</div>
        {total === 0 ? (
          <p data-testid="notifications-empty" className="px-4 py-6 text-sm text-slate-500 text-center">No notifications yet</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {alerts.map((a) => (
              <li key={a.id} data-testid={`job-alert-item-${a.id}`}
                className="px-4 py-3 flex items-start gap-3 text-sm text-slate-700 cursor-pointer hover:bg-emerald-50/60"
                onClick={() => navigate("/nurse/jobs")}>
                <Sparkles className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                <span>
                  <span className="font-semibold text-emerald-700">{a.match_score}% match</span> — {a.job_title || "New job"}
                  {a.hospital_name ? ` at ${a.hospital_name}` : ""}{a.location ? `, ${a.location}` : ""}
                </span>
              </li>
            ))}
            {items.map((n, i) => (
              <li key={i} className="px-4 py-3 flex items-start gap-3 text-sm text-slate-600">
                <n.icon className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                {n.text}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
