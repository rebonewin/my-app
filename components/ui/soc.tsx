import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import type { WidgetAccent } from "@/types/dashboard";

export type SocBadgeTone =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational"
  | "neutral"
  | "accent"
  | "success"
  | "violet"
  | "warning"
  | "danger";

const badgeTones: Record<SocBadgeTone, string> = {
  critical: "bg-soc-critical-soft text-soc-critical",
  high: "bg-soc-high-soft text-soc-high",
  medium: "bg-soc-medium-soft text-soc-medium",
  low: "bg-soc-low-soft text-soc-low",
  informational: "bg-soc-info-soft text-soc-info",
  neutral: "bg-soc-hover text-soc-muted",
  accent: "bg-soc-accent-soft text-soc-accent",
  success: "bg-soc-success-soft text-soc-success",
  violet: "bg-soc-violet-soft text-soc-violet",
  warning: "bg-soc-medium-soft text-soc-medium",
  danger: "bg-soc-critical-soft text-soc-critical",
};

export function SocBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: SocBadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const accentTiles: Record<WidgetAccent, string> = {
  accent: "bg-soc-accent-soft text-soc-accent",
  success: "bg-soc-success-soft text-soc-success",
  warning: "bg-soc-medium-soft text-soc-medium",
  danger: "bg-soc-critical-soft text-soc-critical",
  violet: "bg-soc-violet-soft text-soc-violet",
  blue: "bg-soc-low-soft text-soc-low",
};

export function SocIconTile({
  accent = "accent",
  children,
  className,
}: {
  accent?: WidgetAccent;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        accentTiles[accent],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SocCard({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-soc-border bg-soc-panel backdrop-blur-xl",
        "shadow-[0_1px_0_0_var(--soc-highlight)_inset,0_28px_70px_-48px_var(--soc-shadow)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SocCardHeader({
  title,
  description,
  action,
  className,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-soc-border px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-soc-faint">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-sm font-semibold tracking-tight text-soc-fg">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-soc-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SocCardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

const progressTones = {
  accent: "bg-soc-accent",
  success: "bg-soc-success",
  warning: "bg-soc-medium",
  danger: "bg-soc-critical",
  violet: "bg-soc-violet",
  blue: "bg-soc-low",
} as const;

export function SocProgress({
  value,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  tone?: WidgetAccent;
  className?: string;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-soc-hover", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700", progressTones[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function SocEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soc-hover text-soc-muted">
          {icon}
        </span>
      ) : null}
      <div>
        <p className="text-sm font-medium text-soc-fg">{title}</p>
        {description ? (
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-soc-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function SocSkeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-soc-hover", className)}
      {...props}
    />
  );
}
