import { SocBadge, SocCard } from "@/components/ui/soc";
import { SocLink } from "@/components/ui/soc-button";
import { relativeTime } from "@/lib/utils";
import type { DashboardSnapshot, ScoreWidgetData } from "@/types/dashboard";

export function DashboardHeader({
  firstName,
  snapshot,
}: {
  firstName: string;
  snapshot: DashboardSnapshot;
}) {
  const scoreWidget = snapshot.widgets.find(
    (widget): widget is ScoreWidgetData => widget.kind === "score",
  );
  const critical =
    snapshot.riskOverview.counters.find(
      (counter) => counter.severity === "critical",
    )?.count ?? 0;

  return (
    <SocCard className="relative overflow-hidden border-soc-border/80 bg-soc-panel p-5 sm:p-6 lg:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-soc-accent/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 bottom-[-9rem] h-64 w-64 rounded-full bg-soc-violet/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-soc-accent">
              <span className="relative flex h-1.5 w-1.5">
                <span className="soc-live-dot absolute inline-flex h-full w-full rounded-full bg-soc-accent opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-soc-accent" />
              </span>
              Security posture
            </span>
            <span className="text-soc-faint">/</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-soc-faint">
              {relativeTime(snapshot.generatedAt)}
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.03em] text-soc-fg sm:text-[2rem]">
            Welcome back, {firstName}.{" "}
            <span className="bg-gradient-to-r from-soc-accent via-soc-blue to-soc-violet bg-clip-text text-transparent">
              Your posture is improving.
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-soc-muted sm:text-[13px]">
            {critical > 0
              ? `${critical} critical finding${critical === 1 ? "" : "s"} need an owner and one edge cluster is driving most of the current risk.`
              : "No critical findings are open. Keep the next scan window clear to preserve momentum."}{" "}
            Live telemetry is streaming from all connected assets.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <SocLink href="/scanner" variant="primary" size="md">
              Start new scan
            </SocLink>
            <SocLink href="/findings" variant="secondary" size="md">
              Review findings
            </SocLink>
            <SocLink href="/reports" variant="ghost" size="md">
              Reports <span aria-hidden="true">→</span>
            </SocLink>
          </div>
        </div>

        <div className="grid w-full shrink-0 grid-cols-3 gap-2.5 xl:w-[320px]">
          <div className="rounded-xl border border-soc-border bg-soc-elevated/55 px-3 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
              Score
            </p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-soc-fg">
              {scoreWidget?.value ?? "—"}
              <span className="text-[10px] font-normal text-soc-faint">/100</span>
            </p>
            <p className="mt-1 text-[9px] text-soc-success">
              {scoreWidget ? `+${scoreWidget.delta} this week` : "Awaiting data"}
            </p>
          </div>
          <div className="rounded-xl border border-soc-border bg-soc-elevated/55 px-3 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
              Critical
            </p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-soc-critical">
              {critical}
            </p>
            <p className="mt-1 text-[9px] text-soc-faint">Need triage</p>
          </div>
          <div className="rounded-xl border border-soc-border bg-soc-elevated/55 px-3 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
              Open
            </p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-soc-fg">
              {snapshot.riskOverview.total}
            </p>
            <p className="mt-1 text-[9px] text-soc-faint">Findings</p>
          </div>
          <div className="col-span-3 flex items-center justify-between gap-2 rounded-xl border border-soc-border bg-soc-elevated/40 px-3 py-2.5">
            <span className="inline-flex items-center gap-2 text-[10px] text-soc-muted">
              <span className="soc-live-dot h-1.5 w-1.5 rounded-full bg-soc-success" />
              Telemetry connected
            </span>
            <SocBadge tone="success">SOC live</SocBadge>
          </div>
        </div>
      </div>
    </SocCard>
  );
}
