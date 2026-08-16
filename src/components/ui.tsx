import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
};

const variantClasses: Record<string, string> = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-600/20',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800',
  ghost: 'hover:bg-slate-100 text-slate-600',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/20',
  outline: 'border border-slate-300 hover:border-primary-400 hover:text-primary-600 text-slate-700 bg-white',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  onClick,
  disabled,
  className,
  fullWidth,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50 disabled:cursor-not-allowed',
        'active:scale-[0.98]',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
    >
      {children}
    </button>
  );
}

type BadgeProps = {
  children: ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'teal';
  className?: string;
};

const badgeColors: Record<string, string> = {
  blue: 'bg-primary-50 text-primary-700 border-primary-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  teal: 'bg-teal-50 text-teal-700 border-teal-200',
};

export function Badge({ children, color = 'slate', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        badgeColors[color],
        className
      )}
    >
      {children}
    </span>
  );
}

type CardProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
};

export function Card({ children, className, onClick, hover }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-5 shadow-sm',
        hover && 'transition-all duration-200 hover:shadow-md hover:border-slate-300 cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

type InputProps = {
  label?: string;
  type?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  min?: string | number;
  step?: string;
  className?: string;
  defaultValue?: string;
};

export function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  min,
  step,
  className,
  defaultValue,
}: InputProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      )}
      <input
        type={type}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
        className={cn(
          'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900',
          'placeholder:text-slate-400 transition-colors',
          'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
          className
        )}
      />
    </label>
  );
}

type TextareaProps = {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  className?: string;
};

export function Textarea({ label, value, onChange, placeholder, required, rows = 4, className }: TextareaProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      )}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className={cn(
          'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900',
          'placeholder:text-slate-400 transition-colors resize-none',
          'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
          className
        )}
      />
    </label>
  );
}

type SelectProps = {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function Select({ label, value, onChange, required, children, className }: SelectProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      )}
      <select
        value={value}
        onChange={onChange}
        required={required}
        className={cn(
          'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900',
          'transition-colors cursor-pointer',
          'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
          className
        )}
      >
        {children}
      </select>
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary-600" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon}
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">{title}</h3>
      <p className="mb-4 max-w-sm text-sm text-slate-500">{description}</p>
      {action}
    </div>
  );
}

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  showToast: (type: ToastType, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const toastStyles: Record<ToastType, { bg: string; icon: ReactNode }> = {
  success: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  },
  error: {
    bg: 'bg-red-50 text-red-700 border-red-200',
    icon: <XCircle className="h-4 w-4 shrink-0" />,
  },
  info: {
    bg: 'bg-primary-50 text-primary-700 border-primary-200',
    icon: <AlertCircle className="h-4 w-4 shrink-0" />,
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const style = toastStyles[toast.type];
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg animate-slide-in max-w-sm',
        style.bg
      )}
    >
      {style.icon}
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="shrink-0 opacity-60 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
