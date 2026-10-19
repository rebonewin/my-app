import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/card";
import { ShieldCheckIcon } from "@/components/ui/icons";

export function SecurityScoreRing({
  score,
  grade,
  size = 148,
}: {
  score: number;
  grade: string;
  size?: number;
}) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 85
      ? "#34d399"
      : score >= 70
        ? "#22d3ee"
        : score >= 55
          ? "#fbbf24"
          : "#f87171";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 8px ${color}66)`,
            transition: "stroke-dashoffset 700ms ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight text-white">
          {score}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
          of 100
        </span>
        <span
          className="mt-1 text-xs font-semibold"
          style={{ color }}
        >
          {grade}
        </span>
      </div>
    </div>
  );
}

export function ScoreFactor({
  label,
  points,
  max,
  hint,
}: {
  label: string;
  points: number;
  max: number;
  hint: string;
}) {
  const pct = max > 0 ? Math.round((points / max) * 100) : 0;
  const tone =
    pct >= 100
      ? "bg-emerald-400"
      : pct >= 50
        ? "bg-cyan-400"
        : pct > 0
          ? "bg-amber-400"
          : "bg-red-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-slate-300">
          <ShieldCheckIcon
            size={12}
            className={pct >= 100 ? "text-emerald-400" : "text-slate-600"}
          />
          {label}
        </span>
        <span className="font-mono text-[11px] text-slate-500">
          {points}/{max}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

export function ScoreBadge({ grade }: { grade: string }) {
  const tone =
    grade === "A+" || grade === "A"
      ? "green"
      : grade === "B"
        ? "cyan"
        : grade === "C"
          ? "amber"
          : "red";
  return <Badge tone={tone}>Grade {grade}</Badge>;
}
