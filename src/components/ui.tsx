import { type ReactNode } from "react";
import Link from "next/link";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.03] transition-colors ${className}`}
    >
      {children}
    </div>
  );
}

export function LinkCard({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.03] transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md hover:shadow-black/[0.06] ${className}`}
    >
      {children}
    </Link>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4 rr-fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-medium tracking-tight text-foreground">{children}</h2>
      {action}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-surface-subtle text-muted",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  accent: "bg-accent/10 text-accent",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "submit",
  disabled,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  type?: "submit" | "button";
  disabled?: boolean;
}) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100";
  const variants = {
    primary: "bg-accent text-accent-fg hover:brightness-110 shadow-sm shadow-accent/20",
    secondary: "border border-border bg-surface text-foreground hover:bg-surface-subtle",
    ghost: "text-muted hover:bg-surface-subtle hover:text-foreground",
    danger: "bg-danger-bg text-danger hover:brightness-95",
  } as const;
  return (
    <button type={type} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-shadow placeholder:text-faint focus:ring-2 focus:ring-accent/40 ${className}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-shadow placeholder:text-faint focus:ring-2 focus:ring-accent/40 ${className}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return (
    <select
      {...rest}
      className={`rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-shadow focus:ring-2 focus:ring-accent/40 ${className}`}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export function StatTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: keyof typeof BADGE_TONES }) {
  const toneText = {
    neutral: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    accent: "text-accent",
  }[tone];
  return (
    <Card className="rr-fade-up">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${toneText}`}>{value}</p>
    </Card>
  );
}

export function ProgressBar({ value, tone = "accent" }: { value: number; tone?: "accent" | "success" | "warning" | "danger" }) {
  const barColor = { accent: "bg-accent", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
      <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="border-dashed py-10 text-center">
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </Card>
  );
}
