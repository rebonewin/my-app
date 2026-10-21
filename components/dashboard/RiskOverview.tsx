import Link from "next/link";

import { ArrowRightIcon } from "@/components/ui/icons";
import { SocCard } from "@/components/ui/soc";
import { SocLink } from "@/components/ui/soc-button";
import { SEVERITY_META } from "@/lib/soc/severity";
import type { Severity, SeveritySlice } from "@/types/dashboard";
import { cn } from "@/lib/utils";

const severityStyles: Record<
  Severity,
  { dot: string; bar: string; text: string }
> = {
  critical: {
    dot: "bg-soc-critical",
    bar: "bg-soc-critical",
    text: "text-soc-critical",
  },
  high: { dot: "bg-soc-high", bar: "bg-soc-high", text: "text-soc-high" },
  medium: {
    dot: "bg-soc-medium",
    bar: "bg-soc-medium",
    text: "text-soc-medium",
  },
  low: { dot: "bg-soc-low", bar: "bg-soc-low", text: "text-soc-low" },
  informational: {
    dot: "bg-soc-info",
    bar: "bg-soc-info",
    text: "text-soc-info",
  },
};

export function RiskOverview({
  total,
  counters,
}: {
  total: number;
  counters: SeveritySlice[];
}) {
  return (
    <section aria-labelledby="risk-overview-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="risk-overview-title"
            className="text-sm font-semibold tracking-tight text-soc-fg"
          >
            Risk overview
          </h2>
          <p className="mt-0.5 text-[11px] text-soc-muted">
            {total} open findings across every severity band.
          </p>
        </div>
        <SocLink href="/findings" variant="ghost" size="sm">
          All findings <ArrowRightIcon size={12} />
        </SocLink>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {counters.map((counter, index) => {
          const meta = SEVERITY_META[counter.severity];
          const style = severityStyles[counter.severity];
          const percent = total > 0 ? Math.round((counter.count / total) * 100) : 0;

          return (
            <Link
              key={counter.severity}
              href={counter.href}
              aria-label={`${meta.label}: ${counter.count} findings`}
              className={cn(
                "group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-soc-bg",
                index === counters.length - 1 && "col-span-2 sm:col-span-1",
              )}
            >
              <SocCard className="flex h-full flex-col p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-soc-border-strong group-hover:bg-soc-elevated">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-soc-muted">
                    <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                    {meta.label}
                  </span>
                  <ArrowRightIcon
                    size={12}
                    className="text-soc-faint transition group-hover:translate-x-0.5 group-hover:text-soc-fg"
                  />
                </div>

                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-[1.65rem] font-semibold leading-none tracking-[-0.03em] text-soc-fg">
                    {counter.count}
                  </span>
                  <span className="text-[9px] text-soc-faint">open</span>
                </p>

                <div className="mt-3 h-1 overflow-hidden rounded-full bg-soc-hover">
                  <div
                    className={cn("h-full rounded-full", style.bar)}
                    style={{ width: `${Math.max(percent, 2)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[9px] text-soc-faint">{percent}%</span>
                  <span className={cn("text-[9px] font-medium", style.text)}>
                    {meta.cvss}
                  </span>
                </div>
              </SocCard>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
