import Link from "next/link";

import type { Severity, SeveritySlice } from "@/types/dashboard";

const severityColors: Record<Severity, string> = {
  critical: "var(--soc-critical)",
  high: "var(--soc-high)",
  medium: "var(--soc-medium)",
  low: "var(--soc-low)",
  informational: "var(--soc-info)",
};

export function SeverityDonut({ data }: { data: SeveritySlice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.count, 0);

  if (total === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center text-xs text-soc-muted">
        No open findings. Nice work.
      </p>
    );
  }

  const segments = data.map((slice, index) => {
    const previous = data
      .slice(0, index)
      .reduce((sum, item) => sum + item.count, 0);
    const length = (slice.count / total) * 100;
    const dash = Math.max(length - 1.15, 0.35);
    const offset = (previous / total) * 100 + 0.575;
    return { slice, dash, offset };
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div
        className="relative h-[150px] w-[150px] shrink-0"
        role="img"
        aria-label={`${total} open findings: ${data
          .map((slice) => `${slice.label} ${slice.count}`)
          .join(", ")}`}
      >
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke="var(--soc-track)"
            strokeWidth="13"
          />
          {segments.map(({ slice, dash, offset }) => (
            <circle
              key={slice.severity}
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={severityColors[slice.severity]}
              strokeWidth="13"
              pathLength={100}
              strokeDasharray={`${dash} ${Math.max(100 - dash, 0)}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-soc-fg">
            {total}
          </span>
          <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-soc-faint">
            Open findings
          </span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1.5">
        {data.map((slice) => (
          <li key={slice.severity}>
            <Link
              href={slice.href}
              className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1 outline-none transition hover:bg-soc-hover focus-visible:ring-2 focus-visible:ring-soc-accent/60"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: severityColors[slice.severity] }}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] text-soc-muted group-hover:text-soc-fg">
                {slice.label}
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-soc-fg">
                {slice.count}
              </span>
              <span className="w-9 text-right text-[9px] tabular-nums text-soc-faint">
                {Math.round((slice.count / total) * 100)}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
