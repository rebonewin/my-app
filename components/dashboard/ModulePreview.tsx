import Link from "next/link";

import { ArrowRightIcon, SparklesIcon } from "@/components/ui/icons";
import { SocBadge, SocCard, SocCardHeader, SocIconTile } from "@/components/ui/soc";
import { SocLink } from "@/components/ui/soc-button";
import { SocNavIcon } from "@/components/layout/SocNavIcon";
import type { SocModulePreview } from "@/lib/soc/modules";
import { cn } from "@/lib/utils";

export function ModulePreview({
  module: preview,
}: {
  module: SocModulePreview;
}) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <SocCard className="relative overflow-hidden p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-soc-accent/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <SocIconTile accent={preview.accent} className="h-9 w-9 rounded-xl">
                <SocNavIcon name={preview.icon} size={18} />
              </SocIconTile>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-soc-accent">
                {preview.eyebrow}
              </span>
              <SocBadge tone="violet">{preview.phase}</SocBadge>
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-soc-fg sm:text-3xl">
              {preview.title}
            </h1>
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-soc-muted sm:text-[13px]">
              {preview.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <SocLink href="/dashboard" variant="primary" size="md">
                Back to dashboard
              </SocLink>
              <SocLink href="/scanner" variant="secondary" size="md">
                Start a scan
              </SocLink>
            </div>
          </div>

          <div className="w-full shrink-0 rounded-2xl border border-soc-border bg-soc-elevated/50 p-4 lg:w-[290px]">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
              <SparklesIcon size={12} className="text-soc-violet" />
              Module readiness
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[10px]">
                  <span className="text-soc-muted">Shell integration</span>
                  <span className="font-semibold text-soc-success">Ready</span>
                </div>
                <div className="h-1.5 rounded-full bg-soc-hover">
                  <div className="h-full w-full rounded-full bg-soc-success" />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[10px]">
                  <span className="text-soc-muted">Live service adapter</span>
                  <span className="font-semibold text-soc-medium">Next</span>
                </div>
                <div className="h-1.5 rounded-full bg-soc-hover">
                  <div className="h-full w-2/3 rounded-full bg-soc-medium" />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[10px]">
                  <span className="text-soc-muted">Evidence retention</span>
                  <span className="font-semibold text-soc-accent">Planned</span>
                </div>
                <div className="h-1.5 rounded-full bg-soc-hover">
                  <div className="h-full w-1/3 rounded-full bg-soc-accent" />
                </div>
              </div>
            </div>
            <p className="mt-4 border-t border-soc-border pt-3 text-[9.5px] leading-relaxed text-soc-faint">
              This route already lives inside the authenticated SOC shell. The
              module service and widgets can be added without changing the
              dashboard architecture.
            </p>
          </div>
        </div>
      </SocCard>

      <section aria-labelledby="module-metrics-title">
        <h2
          id="module-metrics-title"
          className="mb-3 text-sm font-semibold tracking-tight text-soc-fg"
        >
          Preview telemetry
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {preview.metrics.map((metric) => (
            <SocCard key={metric.label} className="p-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-soc-faint">
                {metric.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-soc-fg">
                {metric.value}
              </p>
              <p className="mt-1 text-[10px] text-soc-muted">{metric.detail}</p>
            </SocCard>
          ))}
        </div>
      </section>

      <SocCard className="overflow-hidden">
        <SocCardHeader
          title="What ships in this module"
          description="The same evidence model and service boundary used by the dashboard."
          action={
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-[10px] font-medium text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
            >
              Dashboard <ArrowRightIcon size={11} />
            </Link>
          }
        />
        <div className="grid gap-0 md:grid-cols-3">
          {preview.capabilities.map((capability, index) => (
            <div
              key={capability.title}
              className={cn(
                "border-b border-soc-border p-5 md:border-b-0",
                index < preview.capabilities.length - 1 &&
                  "md:border-r md:border-soc-border",
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-soc-accent-soft text-[10px] font-semibold text-soc-accent">
                0{index + 1}
              </span>
              <h3 className="mt-3 text-xs font-semibold text-soc-fg">
                {capability.title}
              </h3>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-soc-muted">
                {capability.description}
              </p>
            </div>
          ))}
        </div>
      </SocCard>
    </div>
  );
}
