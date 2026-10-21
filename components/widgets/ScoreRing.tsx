export function ScoreRing({
  value,
  grade,
  size = 82,
}: {
  value: number;
  grade: string;
  size?: number;
}) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = circumference - (clamped / 100) * circumference;
  const tone =
    clamped >= 80
      ? "var(--soc-success)"
      : clamped >= 60
        ? "var(--soc-accent)"
        : clamped >= 40
          ? "var(--soc-medium)"
          : "var(--soc-critical)";

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--soc-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold tracking-tight text-soc-fg">
          {grade}
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-soc-faint">
          grade
        </span>
      </span>
    </div>
  );
}
