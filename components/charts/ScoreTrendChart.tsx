"use client";

import { useId, useState } from "react";

import type { TrendPoint } from "@/types/dashboard";

const Y_TICKS = 4;

export function ScoreTrendChart({ data }: { data: TrendPoint[] }) {
  const gradientId = useId().replace(/:/g, "");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center text-xs text-soc-muted">
        No score history yet.
      </p>
    );
  }

  const scores = data.map((point) => point.score);
  const dataMin = Math.min(...scores);
  const dataMax = Math.max(...scores);
  const yMin = Math.max(0, Math.floor((dataMin - 8) / 10) * 10);
  const yMax = Math.min(100, Math.ceil((dataMax + 6) / 10) * 10);
  const span = Math.max(1, yMax - yMin);
  const xFor = (index: number) =>
    data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
  const yFor = (score: number) => 100 - ((score - yMin) / span) * 100;

  const linePath = data
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(2)} ${yFor(
          point.score,
        ).toFixed(2)}`,
    )
    .join(" ");

  const areaPath = `${linePath} L ${xFor(data.length - 1).toFixed(2)} 100 L 0 100 Z`;

  const active = activeIndex === null ? null : data[activeIndex];
  const activeX = activeIndex === null ? 0 : xFor(activeIndex);
  const activeY = active ? yFor(active.score) : 0;
  const showEvery = Math.max(1, Math.ceil(data.length / 7));
  const labelIndexes = new Set<number>();
  let lastVisibleLabel: string | null = null;

  data.forEach((point, index) => {
    const sampled = index % showEvery === 0 || index === data.length - 1;
    if (!sampled || point.label === lastVisibleLabel) return;
    labelIndexes.add(index);
    lastVisibleLabel = point.label;
  });

  return (
    <div>
      <div className="relative ml-9 mr-2 h-[210px]">
        {Array.from({ length: Y_TICKS + 1 }, (_, index) => {
          const value = yMax - (span / Y_TICKS) * index;
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

        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--soc-accent)"
                stopOpacity="0.28"
              />
              <stop
                offset="100%"
                stopColor="var(--soc-accent)"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            stroke="var(--soc-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {data.map((point, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={`${point.label}-${index}`}
              type="button"
              aria-label={`${point.label}: security score ${point.score}, ${point.scans} scans`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              className="absolute z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-soc-panel"
              style={{ left: `${xFor(index)}%`, top: `${yFor(point.score)}%` }}
            >
              <span
                className={
                  isActive
                    ? "h-3 w-3 rounded-full border-2 border-soc-accent bg-soc-accent shadow-[0_0_0_4px_var(--soc-accent-soft)]"
                    : "h-2 w-2 rounded-full border border-soc-accent/80 bg-soc-bg"
                }
              />
            </button>
          );
        })}

        {active ? (
          <div
            className="pointer-events-none absolute z-20 whitespace-nowrap rounded-lg border border-soc-border bg-soc-elevated-2 px-2.5 py-1.5 text-[10px] shadow-xl"
            style={{
              left: `${Math.min(88, Math.max(12, activeX))}%`,
              top: `${Math.min(82, activeY + 4)}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-semibold text-soc-fg">{active.label}</p>
            <p className="mt-0.5 text-soc-muted">
              Score <span className="font-semibold text-soc-accent">{active.score}</span>
              <span className="mx-1 text-soc-faint">·</span>
              {active.scans} scans
            </p>
          </div>
        ) : null}
      </div>

      <div className="relative ml-9 mr-2 mt-2 h-4">
        {data.map((point, index) => {
          if (!labelIndexes.has(index)) return null;
          const alignment =
            index === 0
              ? "translate-x-0 text-left"
              : index === data.length - 1
                ? "-translate-x-full text-right"
                : "-translate-x-1/2 text-center";
          return (
            <span
              key={`${point.label}-${index}`}
              className={`absolute text-[9px] text-soc-faint ${alignment}`}
              style={{ left: `${xFor(index)}%` }}
            >
              {point.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
