import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_20px_40px_-24px_rgba(0,0,0,0.8)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

const toneMap = {
  neutral: "border-white/10 bg-white/[0.06] text-slate-300",
  cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  red: "border-red-400/30 bg-red-400/10 text-red-300",
  violet: "border-violet-400/30 bg-violet-400/10 text-violet-300",
} as const;

export type BadgeTone = keyof typeof toneMap;

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        toneMap[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function severityTone(severity: string): BadgeTone {
  switch (severity?.toLowerCase()) {
    case "critical":
    case "high":
      return "red";
    case "medium":
      return "amber";
    case "low":
      return "cyan";
    default:
      return "neutral";
  }
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400">
          {icon}
        </div>
      ) : null}
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        {description ? (
          <p className="mt-1 max-w-sm text-xs text-slate-400">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "cyan",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: BadgeTone;
  icon?: React.ReactNode;
}) {
  const accent: Record<BadgeTone, string> = {
    neutral: "text-slate-300",
    cyan: "text-cyan-300",
    green: "text-emerald-300",
    amber: "text-amber-300",
    red: "text-red-300",
    violet: "text-violet-300",
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {label}
        </p>
        {icon ? <span className={accent[tone]}>{icon}</span> : null}
      </div>
      <p className={cn("mt-3 text-3xl font-semibold tracking-tight", accent[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}
