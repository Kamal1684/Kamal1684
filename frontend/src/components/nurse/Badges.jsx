import { ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { appStatusMeta, verificationMeta } from "../../lib/status";

export const VerificationBadge = ({ status, testId = "nurse-verification-status-badge" }) => {
  const m = verificationMeta(status);
  return (
    <Badge data-testid={testId} variant="outline" className={`${m.cls} font-medium`}>
      {status === "verified" && <ShieldCheck className="h-3 w-3 mr-1" />}
      {m.label}
    </Badge>
  );
};

export const AppStatusBadge = ({ status, testId }) => {
  const m = appStatusMeta(status);
  return (
    <Badge data-testid={testId} variant="outline" className={`${m.cls} font-medium`}>{m.label}</Badge>
  );
};

export const VerifiedHospitalBadge = () => (
  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
    <ShieldCheck className="h-3 w-3 mr-1" /> Verified Hospital
  </Badge>
);

export const MatchBadge = ({ match, jobId }) => {
  if (!match) return null;
  const cls = match.score >= 75
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : match.score >= 50
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge data-testid={`match-percentage-badge-${jobId}`} variant="outline" className={`${cls} font-semibold cursor-help`}>
            <Sparkles className="h-3 w-3 mr-1" /> {match.score}% Match
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-56">
          <p className="font-semibold mb-1">Rule-based match breakdown</p>
          <ul className="space-y-0.5">
            {match.breakdown.map((c) => (
              <li key={c.label} className="flex justify-between gap-4">
                <span>{c.label}</span>
                <span>{c.matched ? "✓" : "✗"} ({c.weight}%)</span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
