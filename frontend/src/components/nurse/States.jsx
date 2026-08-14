import { Loader2, AlertTriangle, Inbox } from "lucide-react";
import { Button } from "../ui/button";

export const LoadingState = ({ label = "Loading..." }) => (
  <div data-testid="loading-state" className="flex flex-col items-center justify-center py-16 text-slate-500">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
    <p className="text-sm">{label}</p>
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div data-testid="error-state" className="flex flex-col items-center justify-center py-16 text-center">
    <AlertTriangle className="h-8 w-8 text-red-500 mb-3" />
    <p className="text-sm text-slate-600 mb-4 max-w-md">{message || "Failed to load data."}</p>
    {onRetry && (
      <Button data-testid="retry-btn" variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    )}
  </div>
);

export const EmptyState = ({ title, description, action, icon: Icon = Inbox, testId = "empty-state" }) => (
  <div data-testid={testId} className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/60">
    <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
      <Icon className="h-6 w-6 text-blue-600" />
    </div>
    <h3 className="font-semibold text-slate-800 mb-1">{title}</h3>
    {description && <p className="text-sm text-slate-500 mb-4 max-w-sm">{description}</p>}
    {action}
  </div>
);
