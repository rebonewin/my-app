import type { SocBadgeTone } from "@/components/ui/soc";
import type { ScanStatus } from "@/types/scanner";

export const SCAN_STATUS_META: Record<
  ScanStatus,
  { label: string; tone: SocBadgeTone; description: string }
> = {
  pending: {
    label: "Pending",
    tone: "neutral",
    description: "Queued and waiting for a worker.",
  },
  running: {
    label: "Running",
    tone: "accent",
    description: "The scanner is collecting evidence.",
  },
  completed: {
    label: "Completed",
    tone: "success",
    description: "Evidence bundle saved.",
  },
  failed: {
    label: "Failed",
    tone: "danger",
    description: "The target or a module failed.",
  },
  cancelled: {
    label: "Cancelled",
    tone: "medium",
    description: "Stopped before completion.",
  },
};

export function scanStatusMeta(value: string) {
  return SCAN_STATUS_META[value as ScanStatus] ?? SCAN_STATUS_META.pending;
}

export function scanDuration(durationMs: number | null | undefined): string {
  if (!durationMs || durationMs < 0) return "—";
  if (durationMs < 1_000) return `${durationMs} ms`;
  const seconds = durationMs / 1_000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}
