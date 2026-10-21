"use client";

import { AssetsByRiskChart } from "./AssetsByRiskChart";
import { ChartCard } from "./ChartCard";
import { ComplianceProgressChart } from "./ComplianceProgressChart";
import { ScanHistoryChart } from "./ScanHistoryChart";
import { ScoreTrendChart } from "./ScoreTrendChart";
import { SeverityDonut } from "./SeverityDonut";
import { SocBadge } from "@/components/ui/soc";
import type { DashboardChartsData } from "@/types/dashboard";

export function DashboardCharts({ data }: { data: DashboardChartsData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard
        title="Security score trend"
        description="Measured posture across the last 14 days"
        action={<SocBadge tone="success">+6.2 pts</SocBadge>}
        className="xl:col-span-2"
      >
        <ScoreTrendChart data={data.scoreTrend} />
      </ChartCard>

      <ChartCard
        title="Scan history"
        description="Completed and failed assessments this week"
        action={
          <span className="text-[10px] font-medium text-soc-faint">7 days</span>
        }
      >
        <ScanHistoryChart data={data.scanHistory} />
      </ChartCard>

      <ChartCard
        title="Vulnerability severity"
        description="Open findings by severity band"
        action={
          <span className="text-[10px] font-medium text-soc-faint">
            {data.severityDistribution.reduce(
              (sum, slice) => sum + slice.count,
              0,
            )}{" "}
            open
          </span>
        }
      >
        <SeverityDonut data={data.severityDistribution} />
      </ChartCard>

      <ChartCard
        title="Assets by risk"
        description="Inventory classified by current exposure"
        action={
          <span className="text-[10px] font-medium text-soc-faint">
            {data.assetsByRisk.reduce((sum, bucket) => sum + bucket.count, 0)}{" "}
            assets
          </span>
        }
      >
        <AssetsByRiskChart data={data.assetsByRisk} />
      </ChartCard>

      <ChartCard
        title="Compliance progress"
        description="Control coverage across active frameworks"
        action={
          <span className="text-[10px] font-medium text-soc-faint">
            {data.compliance.frameworks.length} frameworks
          </span>
        }
      >
        <ComplianceProgressChart data={data.compliance} />
      </ChartCard>
    </div>
  );
}
