import { useEffect, useState } from "react";
import { Bell, CalendarClock, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import api from "../../lib/api";
import { appStatusMeta, fmtDate } from "../../lib/status";

export function NotificationsBell({ role = "nurse" }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/interview"), api.get("/application")])
      .then(([iv, apps]) => {
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
        setItems([...upcoming, ...updates].slice(0, 8));
      })
      .catch(() => setItems([]));
  }, [role]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button data-testid="topbar-notifications-btn" variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-600" />
          {items.length > 0 && (
            <span data-testid="notifications-count-badge" className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
              {items.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm text-slate-800">Notifications</div>
        {items.length === 0 ? (
          <p data-testid="notifications-empty" className="px-4 py-6 text-sm text-slate-500 text-center">No notifications yet</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100">
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
