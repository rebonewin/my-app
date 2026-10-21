import type { ScanDay } from "@/types/dashboard";

const Y_TICKS = 4;

export function ScanHistoryChart({ data }: { data: ScanDay[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center text-xs text-soc-muted">
        No scans recorded yet.
      </p>
    );
  }

  const maxValue = Math.max(
    1,
    ...data.flatMap((day) => [day.completed, day.failed]),
  );
  const yMax = Math.ceil(maxValue / 10) * 10;
  const totalCompleted = data.reduce((sum, day) => sum + day.completed, 0);
  const totalFailed = data.reduce((sum, day) => sum + day.failed, 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-4 text-[10px] text-soc-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-soc-accent" />
          Completed <span className="font-semibold text-soc-fg">{totalCompleted}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-soc-critical" />
          Failed <span className="font-semibold text-soc-fg">{totalFailed}</span>
        </span>
      </div>

      <div className="relative ml-9 mr-1 h-[180px]">
        {Array.from({ length: Y_TICKS + 1 }, (_, index) => {
          const value = yMax - (yMax / Y_TICKS) * index;
          return (
            <div
              key={value}
              className="absolute inset-x-0 border-t border-dashed border-soc-border"
              style={{ top: `${(index / Y_TICKS) * 100}%` }}
            >
              <span className="absolute -left-9 -top-1.5 w-7 text-right text-[9px] tabular-nums text-soc-faint">
                {Math.round(value)}
              </span>
            </div>
          );
        })}

        <div className="absolute inset-0 flex items-end justify-between gap-2">
          {data.map((day) => (
            <div
              key={day.label}
              className="flex h-full min-w-0 flex-1 items-end justify-center gap-1"
              title={`${day.label}: ${day.completed} completed, ${day.failed} failed`}
            >
              <div
                role="img"
                aria-label={`${day.label}: ${day.completed} completed scans`}
                className="w-full max-w-[18px] rounded-t-[3px] bg-gradient-to-t from-soc-accent/45 to-soc-accent transition-opacity hover:opacity-80"
                style={{
                  height: `${Math.max((day.completed / yMax) * 100, 1.5)}%`,
                }}
              />
              <div
                role="img"
                aria-label={`${day.label}: ${day.failed} failed scans`}
                className="w-full max-w-[18px] rounded-t-[3px] bg-gradient-to-t from-soc-critical/45 to-soc-critical transition-opacity hover:opacity-80"
                style={{
                  height: `${Math.max((day.failed / yMax) * 100, 1.5)}%`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="ml-9 mr-1 mt-2 flex justify-between gap-2">
        {data.map((day) => (
          <span
            key={day.label}
            className="min-w-0 flex-1 truncate text-center text-[9px] text-soc-faint"
          >
            {day.label}
          </span>
        ))}
      </div>
    </div>
  );
}
