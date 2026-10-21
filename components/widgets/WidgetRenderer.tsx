import type { DashboardWidget } from "@/types/dashboard";
import { AiSummaryWidget } from "./AiSummaryWidget";
import { ComplianceWidget } from "./ComplianceWidget";
import { MetricWidget } from "./MetricWidget";
import { ScoreWidget } from "./ScoreWidget";

export function WidgetRenderer({
  widget,
  loading = false,
}: {
  widget: DashboardWidget;
  loading?: boolean;
}) {
  switch (widget.kind) {
    case "score":
      return <ScoreWidget widget={widget} loading={loading} />;
    case "metric":
      return <MetricWidget widget={widget} loading={loading} />;
    case "compliance":
      return <ComplianceWidget widget={widget} loading={loading} />;
    case "ai":
      return <AiSummaryWidget widget={widget} loading={loading} />;
  }
}
