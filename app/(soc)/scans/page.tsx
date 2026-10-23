import type { Metadata } from "next";
import Link from "next/link";

import { ScanLauncher } from "@/components/scans/ScanLauncher";
import { ScanQueueTable } from "@/components/scans/ScanQueueTable";
import {
  AlertIcon,
  FilterIcon,
  RadarIcon,
  SettingsIcon,
} from "@/components/ui/icons";
import { SocBadge, SocCard, SocCardBody, SocCardHeader } from "@/components/ui/soc";
import { SocButton, SocLink } from "@/components/ui/soc-button";
import { hasEffectivePermission, requirePermission } from "@/lib/auth/server";
import { tenantScope } from "@/lib/tenancy";
import { SCAN_STATUS_META } from "@/lib/soc/scans";
import { listAssetOptions } from "@/services/assets";
import { listScanProfiles } from "@/services/scanner/profiles";
import { listScans } from "@/services/scanner/scans";
import { SCAN_STATUSES, type ScanStatus } from "@/types/scanner";
import { cn } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = {
  title: "Scan queue",
  description:
    "Queue reusable scan profiles, follow live progress and review scan history.",
};

function findStatus(
  value: string | string[] | undefined,
): ScanStatus | "active" | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "active") return "active";
  return SCAN_STATUSES.find((status) => status === candidate);
}

function queueHref(
  params: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    const item = Array.isArray(value) ? value[0] : value;
    if (item) query.set(key, item);
  }
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/scans?${suffix}` : "/scans";
}

function pollHref(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams({ pageSize: "50" });
  for (const key of ["status", "assetId", "q", "page"]) {
    const value = params[key];
    const item = Array.isArray(value) ? value[0] : value;
    if (item) query.set(key, item);
  }
  return `/api/scans?${query.toString()}`;
}

export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePermission("scanner:read", { next: "/scans" });
  const scope = tenantScope(context);
  const params = await searchParams;
  const status = findStatus(params.status);
  const assetId =
    typeof params.assetId === "string" ? params.assetId : undefined;
  const query = typeof params.q === "string" ? params.q : undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [queue, profiles, assets] = await Promise.all([
    listScans(scope, {
      status,
      assetId,
      query,
      page,
      pageSize: 20,
    }),
    listScanProfiles(scope),
    listAssetOptions(scope),
  ]);

  const canStart = hasEffectivePermission(context, "scanner:start");
  const canStop = hasEffectivePermission(context, "scanner:stop");
  const totalPages = Math.max(1, Math.ceil(queue.total / queue.pageSize));
  const activeCount = queue.counts.pending + queue.counts.running;
  const hasFilters = Boolean(status || assetId || query);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-soc-accent">
            Orchestration
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-soc-fg sm:text-3xl">
            Scan queue
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-soc-muted">
            Queue reusable profiles against active assets, watch the current
            module, and keep every evidence bundle for comparison.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SocLink href="/assets" variant="secondary" size="md">
            <RadarIcon size={14} />
            Asset inventory
          </SocLink>
          <SocLink href="/scans/profiles" variant="secondary" size="md">
            <SettingsIcon size={14} />
            Profiles
          </SocLink>
        </div>
      </div>

      <section
        aria-label="Queue status summary"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5"
      >
        {SCAN_STATUSES.map((value) => {
          const meta = SCAN_STATUS_META[value];
          const active = value === "pending" || value === "running";
          return (
            <Link
              key={value}
              href={status === value ? "/scans" : `/scans?status=${value}`}
              className={cn(
                "rounded-2xl border p-3.5 outline-none transition hover:-translate-y-0.5 hover:bg-soc-hover focus-visible:ring-2 focus-visible:ring-soc-accent/60",
                status === value
                  ? "border-soc-accent/40 bg-soc-accent-soft/40"
                  : "border-soc-border bg-soc-panel",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                  {meta.label}
                </p>
                {active ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-soc-accent" />
                ) : null}
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-soc-fg">
                {queue.counts[value]}
              </p>
              <p className="mt-1 text-[9px] text-soc-faint">
                {value === "pending"
                  ? "waiting for a worker"
                  : value === "running"
                    ? "collecting evidence"
                    : value === "completed"
                      ? "evidence saved"
                      : value === "failed"
                        ? "needs review"
                        : "stopped by operator"}
              </p>
            </Link>
          );
        })}
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_332px]">
        <div className="min-w-0 space-y-4">
          <SocCard className="p-3 sm:p-4">
            <form action="/scans" method="get" className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <label htmlFor="scan-search" className="sr-only">
                    Search scans
                  </label>
                  <input
                    id="scan-search"
                    name="q"
                    defaultValue={query ?? ""}
                    placeholder="Search target, asset or profile…"
                    className="h-9 w-full rounded-lg border border-soc-border bg-soc-elevated px-3 text-[11px] text-soc-fg outline-none placeholder:text-soc-faint focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                  />
                </div>
                <SocButton type="submit" variant="secondary" size="sm">
                  <FilterIcon size={12} />
                  Search
                </SocButton>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <label className="sr-only" htmlFor="scan-status-filter">
                  Status
                </label>
                <select
                  id="scan-status-filter"
                  name="status"
                  defaultValue={status ?? ""}
                  className="h-8 rounded-lg border border-soc-border bg-soc-elevated px-2 text-[10px] text-soc-fg outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active only</option>
                  {SCAN_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {SCAN_STATUS_META[value].label}
                    </option>
                  ))}
                </select>

                <label className="sr-only" htmlFor="scan-asset-filter">
                  Asset
                </label>
                <select
                  id="scan-asset-filter"
                  name="assetId"
                  defaultValue={assetId ?? ""}
                  className="h-8 rounded-lg border border-soc-border bg-soc-elevated px-2 text-[10px] text-soc-fg outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                >
                  <option value="">All assets</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center">
                  <p className="text-[9px] text-soc-faint">
                    {activeCount} active · {queue.total} in this view
                  </p>
                </div>
              </div>

              {hasFilters ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-soc-border pt-3">
                  <span className="text-[9px] uppercase tracking-[0.14em] text-soc-faint">
                    Filters
                  </span>
                  {status ? (
                    <SocBadge
                      tone={
                        status === "active"
                          ? "accent"
                          : SCAN_STATUS_META[status].tone
                      }
                    >
                      {status === "active"
                        ? "Active"
                        : SCAN_STATUS_META[status].label}
                    </SocBadge>
                  ) : null}
                  {assetId ? <SocBadge tone="accent">Asset scoped</SocBadge> : null}
                  {query ? <SocBadge tone="neutral">“{query}”</SocBadge> : null}
                  <Link
                    href="/scans"
                    className="text-[9px] font-medium text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                  >
                    Clear
                  </Link>
                </div>
              ) : null}
            </form>
          </SocCard>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] text-soc-muted">
              Showing{" "}
              <span className="font-semibold text-soc-fg">{queue.items.length}</span>{" "}
              of {queue.total} scans
            </p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-soc-faint">
              Live · polling every 4 seconds
            </p>
          </div>

          <ScanQueueTable
            initialData={queue}
            pollUrl={pollHref(params)}
            canStop={canStop}
          />

          {totalPages > 1 ? (
            <nav
              className="flex items-center justify-between gap-3"
              aria-label="Scan pagination"
            >
              <SocLink
                href={queueHref(params, Math.max(1, queue.page - 1))}
                variant="secondary"
                size="sm"
                className={queue.page <= 1 ? "pointer-events-none opacity-40" : ""}
              >
                Previous
              </SocLink>
              <p className="text-[10px] text-soc-muted">
                Page {queue.page} of {totalPages}
              </p>
              <SocLink
                href={queueHref(params, Math.min(totalPages, queue.page + 1))}
                variant="secondary"
                size="sm"
                className={
                  queue.page >= totalPages
                    ? "pointer-events-none opacity-40"
                    : ""
                }
              >
                Next
              </SocLink>
            </nav>
          ) : null}
        </div>

        <aside className="space-y-4" aria-label="Queue controls">
          <ScanLauncher
            assets={assets}
            profiles={profiles}
            canStart={canStart}
            defaultAssetId={assetId}
          />

          <SocCard className="overflow-hidden">
            <SocCardHeader
              title="How the queue works"
              description="One worker claim per scan"
            />
            <SocCardBody className="space-y-3">
              {[
                "A profile is snapshotted onto the scan so later edits never rewrite history.",
                "Workers atomically claim pending jobs before opening a socket.",
                "Progress and the current module are persisted after every stage.",
                "Cancellation is checked between stages and stops the worker.",
              ].map((item, index) => (
                <div key={item} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-soc-accent-soft text-[9px] font-semibold text-soc-accent">
                    {index + 1}
                  </span>
                  <p className="text-[9.5px] leading-relaxed text-soc-muted">
                    {item}
                  </p>
                </div>
              ))}
            </SocCardBody>
          </SocCard>

          <SocCard className="p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-soc-medium-soft text-soc-medium">
                <AlertIcon size={14} />
              </span>
              <div>
                <p className="text-[10px] font-semibold text-soc-fg">
                  Scheduled scans are next
                </p>
                <p className="text-[9px] text-soc-faint">
                  Asset and profile records are ready for it
                </p>
              </div>
            </div>
            <p className="mt-2.5 text-[9.5px] leading-relaxed text-soc-muted">
              The queue service accepts any producer. A scheduler can enqueue
              the same jobs with no UI changes.
            </p>
          </SocCard>
        </aside>
      </div>
    </div>
  );
}
