import Link from "next/link";

import { ArrowRightIcon } from "@/components/ui/icons";
import {
  SocCard,
  SocIconTile,
  SocSkeleton,
  type SocBadgeTone,
} from "@/components/ui/soc";
import type { WidgetAccent, WidgetIconName } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { WidgetIcon } from "./WidgetIcon";

export function WidgetShell({
  label,
  icon,
  accent = "accent",
  href,
  loading = false,
  empty = false,
  emptyTitle = "No data yet",
  emptyDescription = "Telemetry will appear after the next collection cycle.",
  className,
  children,
  footer,
}: {
  label: string;
  icon: WidgetIconName;
  accent?: WidgetAccent;
  href?: string;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const body = loading ? (
    <div className="flex flex-1 flex-col justify-center gap-3 py-2" aria-hidden="true">
      <SocSkeleton className="h-8 w-24" />
      <SocSkeleton className="h-3 w-4/5" />
      <SocSkeleton className="h-2 w-full" />
    </div>
  ) : empty ? (
    <div className="flex flex-1 flex-col justify-center gap-1.5 py-3">
      <p className="text-sm font-medium text-soc-fg">{emptyTitle}</p>
      <p className="text-[11px] leading-relaxed text-soc-muted">
        {emptyDescription}
      </p>
    </div>
  ) : (
    <div className="mt-4 flex flex-1 flex-col">{children}</div>
  );

  const card = (
    <SocCard
      aria-busy={loading}
      className={cn(
        "flex h-full min-h-[178px] flex-col p-5 transition-colors duration-300",
        href &&
          "group-hover:border-soc-border-strong group-hover:bg-soc-elevated/70",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <SocIconTile accent={accent} className="h-8 w-8 rounded-lg">
            <WidgetIcon name={icon} size={15} />
          </SocIconTile>
          <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-soc-muted">
            {label}
          </p>
        </div>
        {href ? (
          <ArrowRightIcon
            size={14}
            className="mt-1 shrink-0 text-soc-faint transition group-hover:translate-x-0.5 group-hover:text-soc-accent"
          />
        ) : null}
      </div>

      {body}

      {!loading && !empty && footer ? (
        <div className="mt-4 border-t border-soc-border pt-3">{footer}</div>
      ) : null}
    </SocCard>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      aria-label={`Open ${label}`}
      className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-soc-bg"
    >
      {card}
    </Link>
  );
}

export function WidgetDelta({
  value,
  label,
  tone = "neutral",
  suffix = "%",
}: {
  value: number;
  label?: string;
  tone?: "positive" | "negative" | "neutral";
  suffix?: string;
}) {
  const sign = value > 0 ? "+" : "";
  const classes =
    tone === "positive"
      ? "text-soc-success"
      : tone === "negative"
        ? "text-soc-critical"
        : "text-soc-muted";

  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium", classes)}>
      {sign}
      {value}
      {suffix}
      {label ? <span className="font-normal text-soc-faint">{label}</span> : null}
    </span>
  );
}

export const widgetToneMap: Record<WidgetAccent, SocBadgeTone> = {
  accent: "accent",
  success: "success",
  warning: "medium",
  danger: "critical",
  violet: "violet",
  blue: "low",
};
