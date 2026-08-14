export const APPLICATION_STEPS = [
  { key: "submitted", label: "Applied" },
  { key: "under_review", label: "Under Review" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview_scheduled", label: "Interview Scheduled" },
  { key: "selected", label: "Selected" },
];

export const APP_STATUS_META = {
  submitted: { label: "Applied", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  under_review: { label: "Under Review", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  shortlisted: { label: "Shortlisted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  interview_scheduled: { label: "Interview Scheduled", cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  selected: { label: "Selected", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200" },
  withdrawn: { label: "Withdrawn", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const VERIFICATION_META = {
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  under_review: { label: "Under Review", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  verified: { label: "Verified", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200" },
};

export const appStatusMeta = (s) => APP_STATUS_META[s] || APP_STATUS_META.submitted;
export const verificationMeta = (s) => VERIFICATION_META[s] || VERIFICATION_META.pending;

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? String(iso) : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
};

export const fmtSalary = (job) => {
  if (job.salary_min && job.salary_max) return `₹${Number(job.salary_min).toLocaleString()} – ₹${Number(job.salary_max).toLocaleString()}`;
  if (job.salary_max) return `Up to ₹${Number(job.salary_max).toLocaleString()}`;
  if (job.salary_min) return `From ₹${Number(job.salary_min).toLocaleString()}`;
  if (job.salary) return `₹${Number(job.salary).toLocaleString()}`;
  return "Not disclosed";
};
