"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ClockIcon, RadarIcon } from "@/components/ui/icons";
import {
  SocBadge,
  SocCard,
  SocEmptyState,
  SocProgress,
} from "@/components/ui/soc";
import { SocButton } from "@/components/ui/soc-button";
import { scanDuration, scanStatusMeta } from "@/lib/soc/scans";
import { formatDate, relativeTime } from "@/lib/utils";
import { ACTIVE_SCAN_STATUSES, type ScanQueueData, type ScanQueueItem } from "@/types/scanner";

function statusTone(status: string) {
  return scanStatusMeta(status).tone;
}

export function ScanQueueTable({
  initialData,
  pollUrl,
  canStop,
}: {
  initialData: ScanQueueData;
  pollUrl: string;
  canStop: boolean;
}) {
  const [data, setData] = useState<ScanQueueData>(initialData);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch(pollUrl, { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as ScanQueueData;
        if (active) setData(next);
      } catch {
        // Polling is best-effort; the next tick retries.
      }
    }

    const timer = window.setInterval(refresh, 4_000);
    void refresh();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pollUrl]);

  async function cancel(item: ScanQueueItem) {
    if (cancelling) return;
    const confirmed = window.confirm(
      `Cancel the queued scan for ${item.assetName ?? item.target}?`,
    );
    if (!confirmed) return;

    setCancelling(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/scans/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(payload?.error ?? "The scan could not be cancelled.");
        return;
      }

      setData((current) => ({
        ...current,
        items: current.items.map((row) =>
          row.id === item.id
            ? {
                ...row,
                status: "cancelled",
                currentModule: "Cancelled",
                cancelledAt: new Date().toISOString(),
              }
            : row,
        ),
      }));
    } catch {
      setError("Network error while cancelling the scan.");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <SocCard className="overflow-hidden" aria-live="polite">
      <div className="hidden grid-cols-[7.5rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_8rem_7rem] gap-3 border-b border-soc-border bg-soc-elevated/40 px-5 py-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-soc-faint lg:grid">
        <span>Status</span>
        <span>Target</span>
        <span>Profile</span>
        <span>Progress</span>
        <span>Timing</span>
        <span className="text-right">Action</span>
      </div>

      {error ? (
        <p className="border-b border-soc-border px-5 py-2 text-[10px] text-soc-critical">
          {error}
        </p>
      ) : null}

      {data.items.length === 0 ? (
        <SocEmptyState
          icon={<RadarIcon size={18} />}
          title="The queue is empty"
          description="Queue a profile against an active asset to populate scan history."
        />
      ) : (
        <ul className="divide-y divide-soc-border">
          {data.items.map((item) => {
            const active = ACTIVE_SCAN_STATUSES.includes(item.status);
            return (
              <li
                key={item.id}
                className="grid gap-3 px-4 py-4 transition hover:bg-soc-hover/40 sm:px-5 lg:grid-cols-[7.5rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_8rem_7rem] lg:items-center"
              >
                <div>
                  <SocBadge tone={statusTone(item.status)}>
                    {scanStatusMeta(item.status).label}
                  </SocBadge>
                  {item.currentModule ? (
                    <p className="mt-1.5 text-[9px] text-soc-faint">
                      {item.currentModule}
                    </p>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <Link
                    href={`/scans/${item.id}`}
                    className="block truncate text-[11.5px] font-medium text-soc-fg outline-none hover:text-soc-accent focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                  >
                    {item.assetName ?? item.target}
                  </Link>
                  <p className="mt-0.5 truncate font-mono text-[9px] text-soc-muted">
                    {item.target}
                  </p>
                  <p className="mt-0.5 text-[9px] text-soc-faint lg:hidden">
                    {item.profileName ?? "Standalone scan"}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[10px] text-soc-muted">
                    {item.profileName ?? "Standalone scan"}
                  </p>
                  <p className="mt-0.5 text-[9px] text-soc-faint">
                    {item.profileModules.length} modules ·{" "}
                    {item.findingCount} findings
                  </p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[9px] text-soc-faint">
                      {item.progress}%
                    </span>
                    <span className="text-[9px] text-soc-faint">
                      {item.riskLevel !== "unknown"
                        ? `risk ${item.riskScore}`
                        : "queued"}
                    </span>
                  </div>
                  <SocProgress
                    value={item.progress}
                    tone={
                      item.status === "failed"
                        ? "danger"
                        : item.status === "completed"
                          ? "success"
                          : "accent"
                    }
                    label={`${item.assetName ?? item.target} scan progress`}
                  />
                </div>

                <div>
                  <p className="text-[10px] text-soc-muted">
                    {item.startedAt
                      ? relativeTime(item.startedAt)
                      : relativeTime(item.createdAt)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[9px] text-soc-faint">
                    <ClockIcon size={10} />
                    {item.durationMs != null
                      ? scanDuration(item.durationMs)
                      : "waiting"}
                  </p>
                  <p className="mt-0.5 hidden text-[9px] text-soc-faint sm:block">
                    {formatDate(item.createdAt)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 lg:justify-end">
                  <Link
                    href={`/scans/${item.id}`}
                    className="text-[10px] font-medium text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                  >
                    Details
                  </Link>
                  {active && canStop ? (
                    <SocButton
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => cancel(item)}
                      disabled={cancelling === item.id}
                    >
                      {cancelling === item.id ? "…" : "Cancel"}
                    </SocButton>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SocCard>
  );
}
