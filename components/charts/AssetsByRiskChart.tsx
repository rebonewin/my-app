import type { RiskBucket, WidgetAccent } from "@/types/dashboard";

const barTones: Record<WidgetAccent, string> = {
  accent: "bg-soc-accent",
  success: "bg-soc-success",
  warning: "bg-soc-medium",
  danger: "bg-soc-critical",
  violet: "bg-soc-violet",
  blue: "bg-soc-low",
};

export function AssetsByRiskChart({ data }: { data: RiskBucket[] }) {
  const total = data.reduce((sum, bucket) => sum + bucket.count, 0);
  const max = Math.max(1, ...data.map((bucket) => bucket.count));

  if (total === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center text-xs text-soc-muted">
        No assets classified yet.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-soc-fg">
            {total.toLocaleString("en-US")}
          </p>
          <p className="mt-0.5 text-[10px] text-soc-faint">
            Classified assets
          </p>
        </div>
        <span className="rounded-full bg-soc-hover px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-soc-faint">
          Live inventory
        </span>
      </div>

      <ul className="space-y-3" aria-label="Assets by risk level">
        {data.map((bucket) => {
          const percent = Math.round((bucket.count / total) * 100);
          return (
            <li key={bucket.label}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] text-soc-muted">{bucket.label}</span>
                <span className="text-[10px] tabular-nums text-soc-faint">
                  <span className="font-semibold text-soc-fg">{bucket.count}</span>{" "}
                  · {percent}%
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-soc-hover"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${bucket.label} assets: ${bucket.count}, ${percent}%`}
              >
                <div
                  className={`h-full rounded-full ${barTones[bucket.accent]}`}
                  style={{ width: `${Math.max((bucket.count / max) * 100, 2)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
