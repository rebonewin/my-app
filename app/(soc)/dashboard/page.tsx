import type { Metadata } from "next";

import { LazyDashboardCharts } from "@/components/charts/LazyDashboardCharts";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentFindings } from "@/components/dashboard/RecentFindings";
import { RiskOverview } from "@/components/dashboard/RiskOverview";
import { ThreatLevelCard } from "@/components/dashboard/ThreatLevelCard";
import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";
import { requirePermission } from "@/lib/auth/server";
import { getDashboardSnapshot } from "@/services/dashboard";
import { cn } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = {
  title: "Security Operations Center",
  description:
    "Security posture, exposure, scan history and live activity in one command centre.",
};

export default async function DashboardPage() {
  const context = await requirePermission("dashboard:read", {
    next: "/dashboard",
  });
  const snapshot = await getDashboardSnapshot();
  const firstName = context.user.name.trim().split(/\s+/)[0] || "analyst";

  return (
    <div className="space-y-5 sm:space-y-6">
      <DashboardHeader firstName={firstName} snapshot={snapshot} />

      <QuickActions actions={snapshot.quickActions} />

      <section aria-label="Security posture widgets">
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {snapshot.widgets.map((widget, index) => (
            <div
              key={widget.id}
              className={cn(
                "soc-rise h-full min-w-0",
                widget.kind === "ai" && "sm:col-span-2 xl:col-span-1",
              )}
              style={{ animationDelay: `${Math.min(index * 45, 260)}ms` }}
            >
              <WidgetRenderer widget={widget} />
            </div>
          ))}
        </div>
      </section>

      <RiskOverview
        total={snapshot.riskOverview.total}
        counters={snapshot.riskOverview.counters}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_332px]">
        <div className="min-w-0 space-y-4">
          <LazyDashboardCharts data={snapshot.charts} />
          <RecentFindings findings={snapshot.recentFindings} />
        </div>

        <aside className="hidden min-w-0 xl:block" aria-label="Live activity">
          <div className="soc-scroll sticky top-[88px] max-h-[calc(100dvh-104px)] space-y-3.5 overflow-y-auto pb-1 pr-1">
            <ThreatLevelCard threatLevel={snapshot.threatLevel} />
            <ActivityFeed events={snapshot.activity} />
          </div>
        </aside>
      </div>

      <div className="xl:hidden">
        <ActivityFeed events={snapshot.activity} />
      </div>
    </div>
  );
}
