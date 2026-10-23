import type { AssetScanSummary } from "@/types/assets";

export function SeverityTrend({ scans }: { scans: AssetScanSummary[] }) {
  const completed = scans
    .filter((scan) => scan.status === "completed")
    .slice(0, 8)
    .reverse();

  if (completed.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-[10px] text-soc-muted">
        No completed scans to trend yet.
      </p>
    );
  }

  const max = Math.max(1, ...completed.map((scan) => scan.findingCount));

  return (
    <div className="space-y-2.5">
      {completed.map((scan) => {
        const total = scan.findingCount;
        const width = (value: number) =>
          `${Math.max(0, Math.round((value / max) * 100))}%`;
        return (
          <div key={scan.id}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[9px] text-soc-muted">
                {new Intl.DateTimeFormat("en-GB", {
                  month: "short",
                  day: "2-digit",
                  timeZone: "UTC",
                }).format(new Date(scan.createdAt))}
              </span>
              <span className="text-[9px] tabular-nums text-soc-faint">
                {scan.findingCount} findings
              </span>
            </div>
            <div
              className="flex h-2 overflow-hidden rounded-full bg-soc-hover"
              role="img"
              aria-label={`${scan.findingCount} findings: ${scan.criticalCount} critical, ${scan.highCount} high, ${scan.mediumCount} medium`}
            >
              <span
                className="h-full bg-soc-critical"
                style={{ width: width(scan.criticalCount) }}
              />
              <span
                className="h-full bg-soc-high"
                style={{ width: width(scan.highCount) }}
              />
              <span
                className="h-full bg-soc-medium"
                style={{ width: width(scan.mediumCount) }}
              />
              <span
                className="h-full bg-soc-low"
                style={{
                  width: width(
                    Math.max(
                      0,
                      total - scan.criticalCount - scan.highCount - scan.mediumCount,
                    ),
                  ),
                }}
              />
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-[8px] uppercase tracking-[0.1em] text-soc-faint">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-soc-critical" />
          Critical
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-soc-high" />
          High
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-soc-medium" />
          Medium
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-soc-low" />
          Other
        </span>
      </div>
    </div>
  );
}
