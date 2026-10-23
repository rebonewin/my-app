"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ClockIcon, LoaderIcon } from "@/components/ui/icons";
import {
  SocBadge,
  SocCard,
  SocCardBody,
  SocCardHeader,
  SocProgress,
} from "@/components/ui/soc";
import { scanDuration, scanStatusMeta } from "@/lib/soc/scans";
import { relativeTime } from "@/lib/utils";
import {
  ACTIVE_SCAN_STATUSES,
  type ScanQueueItem,
} from "@/types/scanner";

export function ScanProgressLive({
  initialScan,
}: {
  initialScan: ScanQueueItem;
}) {
  const router = useRouter();
  const [scan, setScan] = useState(initialScan);

  useEffect(() => {
    if (!ACTIVE_SCAN_STATUSES.includes(scan.status)) return;
    let active = true;

    async function refresh() {
      try {
        const response = await fetch(`/api/scans/${scan.id}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          scan: ScanQueueItem;
        };
        if (!active) return;
        setScan(data.scan);
        if (!ACTIVE_SCAN_STATUSES.includes(data.scan.status)) {
          router.refresh();
        }
      } catch {
        // Best effort; the next tick retries.
      }
    }

    const timer = window.setInterval(refresh, 2_000);
    void refresh();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [router, scan.id, scan.status]);

  const meta = scanStatusMeta(scan.status);
  const isActive = ACTIVE_SCAN_STATUSES.includes(scan.status);

  return (
    <SocCard className="overflow-hidden">
      <SocCardHeader
        title="Scan orchestration"
        description={`${scan.profileName ?? "Standalone scan"} · ${scan.target}`}
        action={
          <SocBadge tone={meta.tone}>
            {isActive ? <LoaderIcon size={10} className="animate-spin" /> : null}
            {meta.label}
          </SocBadge>
        }
      />
      <SocCardBody className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-soc-fg">
              {scan.currentModule ?? "Queued"}
            </p>
            <p className="mt-0.5 text-[9px] text-soc-faint">
              {isActive
                ? "The queue is polling every two seconds."
                : meta.description}
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-soc-fg">
            {scan.progress}%
          </span>
        </div>
        <SocProgress
          value={scan.progress}
          tone={
            scan.status === "failed"
              ? "danger"
              : scan.status === "completed"
                ? "success"
                : "accent"
          }
          label="Scan progress"
        />
        <div className="grid grid-cols-2 gap-3 border-t border-soc-border pt-3 sm:grid-cols-4">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
              Queued
            </p>
            <p className="mt-1 text-[10px] text-soc-muted">
              {relativeTime(scan.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
              Started
            </p>
            <p className="mt-1 text-[10px] text-soc-muted">
              {scan.startedAt ? relativeTime(scan.startedAt) : "Waiting"}
            </p>
          </div>
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
              Duration
            </p>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-soc-muted">
              <ClockIcon size={10} />
              {scan.durationMs != null ? scanDuration(scan.durationMs) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
              Findings
            </p>
            <p className="mt-1 text-[10px] text-soc-muted">
              {scan.findingCount} · risk {scan.riskScore}/100
            </p>
          </div>
        </div>
        {scan.error ? (
          <p className="rounded-lg border border-soc-critical/20 bg-soc-critical-soft px-3 py-2 text-[10px] text-soc-critical">
            {scan.error}
          </p>
        ) : null}
      </SocCardBody>
    </SocCard>
  );
}
