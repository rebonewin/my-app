import type { Metadata } from "next";
import Link from "next/link";

import { AssetSummaryCards } from "@/components/assets/AssetSummaryCards";
import { AssetTable } from "@/components/assets/AssetTable";
import {
  CertificateIcon,
  FilterIcon,
  PlusIcon,
  RadarIcon,
  ServerIcon,
  ShieldCheckIcon,
} from "@/components/ui/icons";
import { SocBadge, SocCard, SocCardBody, SocCardHeader } from "@/components/ui/soc";
import { SocButton, SocLink } from "@/components/ui/soc-button";
import {
  getAssetDashboard,
  listAssets,
} from "@/services/assets";
import { hasEffectivePermission, requirePermission } from "@/lib/auth/server";
import { tenantScope } from "@/lib/tenancy";
import {
  assetEnvironmentLabel,
  assetTypeLabel,
  criticalityMeta,
  riskMeta,
} from "@/lib/soc/assets";
import { formatDate, relativeTime } from "@/lib/utils";
import {
  ASSET_CRITICALITIES,
  ASSET_ENVIRONMENTS,
  ASSET_RISK_LEVELS,
  ASSET_STATUSES,
  ASSET_TYPES,
  type AssetCriticality,
  type AssetEnvironment,
  type AssetRiskLevel,
  type AssetStatus,
  type AssetType,
} from "@/types/assets";
import { cn } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = {
  title: "Asset inventory",
  description:
    "Register, classify and scan the websites, APIs and services in scope.",
};

function findValue<T extends string>(
  values: readonly T[],
  value: string | string[] | undefined,
): T | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return values.find((item) => item === candidate);
}

function sortValue(
  value: string | string[] | undefined,
): "recent" | "name" | "risk" | "criticality" | "last-scan" {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ["recent", "name", "risk", "criticality", "last-scan"].includes(
    candidate ?? "",
  )
    ? (candidate as "recent" | "name" | "risk" | "criticality" | "last-scan")
    : "recent";
}

function pageHref(
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
  return suffix ? `/assets?${suffix}` : "/assets";
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePermission("scanner:read", { next: "/assets" });
  const scope = tenantScope(context);
  const params = await searchParams;

  const query = typeof params.q === "string" ? params.q : undefined;
  const type = findValue<AssetType>(ASSET_TYPES, params.type);
  const environment = findValue<AssetEnvironment>(
    ASSET_ENVIRONMENTS,
    params.environment,
  );
  const criticality = findValue<AssetCriticality>(
    ASSET_CRITICALITIES,
    params.criticality,
  );
  const status = findValue<AssetStatus>(ASSET_STATUSES, params.status);
  const riskLevel = findValue<AssetRiskLevel>(ASSET_RISK_LEVELS, params.riskLevel);
  const sort = sortValue(params.sort);
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [dashboard, inventory] = await Promise.all([
    getAssetDashboard(scope),
    listAssets(scope, {
      query,
      type,
      environment,
      criticality,
      status,
      riskLevel,
      sort,
      page,
      pageSize: 12,
    }),
  ]);

  const canManage = hasEffectivePermission(context, "scanner:start");
  const totalPages = Math.max(1, Math.ceil(inventory.total / inventory.pageSize));
  const hasFilters = Boolean(
    query || type || environment || criticality || status || riskLevel || sort !== "recent",
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-soc-accent">
            Attack surface
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-soc-fg sm:text-3xl">
            Asset inventory
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-soc-muted">
            Register every website, API and service in scope, classify it by
            business criticality, then launch reusable scans from the queue.
          </p>
        </div>
        <div className="flex gap-2">
          <SocLink href="/scans" variant="secondary" size="md">
            <RadarIcon size={14} />
            Scan queue
          </SocLink>
          {canManage ? (
            <SocLink href="/assets/new" variant="primary" size="md">
              <PlusIcon size={14} />
              Add asset
            </SocLink>
          ) : null}
        </div>
      </div>

      <AssetSummaryCards stats={dashboard.stats} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_318px]">
        <div className="min-w-0 space-y-4">
          <SocCard className="p-3 sm:p-4">
            <form action="/assets" method="get" className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <label htmlFor="asset-search" className="sr-only">
                    Search assets
                  </label>
                  <input
                    id="asset-search"
                    name="q"
                    defaultValue={query ?? ""}
                    placeholder="Search name, URL, domain or owner…"
                    className="h-9 w-full rounded-lg border border-soc-border bg-soc-elevated px-3 text-[11px] text-soc-fg outline-none placeholder:text-soc-faint focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                  />
                </div>
                <SocButton type="submit" variant="secondary" size="sm">
                  <FilterIcon size={12} />
                  Search
                </SocButton>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <label className="sr-only" htmlFor="asset-type-filter">
                  Asset type
                </label>
                <select
                  id="asset-type-filter"
                  name="type"
                  defaultValue={type ?? ""}
                  className="h-8 rounded-lg border border-soc-border bg-soc-elevated px-2 text-[10px] text-soc-fg outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                >
                  <option value="">All types</option>
                  {ASSET_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {assetTypeLabel(value)}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="asset-environment-filter">
                  Environment
                </label>
                <select
                  id="asset-environment-filter"
                  name="environment"
                  defaultValue={environment ?? ""}
                  className="h-8 rounded-lg border border-soc-border bg-soc-elevated px-2 text-[10px] text-soc-fg outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                >
                  <option value="">All environments</option>
                  {ASSET_ENVIRONMENTS.map((value) => (
                    <option key={value} value={value}>
                      {assetEnvironmentLabel(value)}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="asset-criticality-filter">
                  Criticality
                </label>
                <select
                  id="asset-criticality-filter"
                  name="criticality"
                  defaultValue={criticality ?? ""}
                  className="h-8 rounded-lg border border-soc-border bg-soc-elevated px-2 text-[10px] text-soc-fg outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                >
                  <option value="">All criticalities</option>
                  {ASSET_CRITICALITIES.map((value) => (
                    <option key={value} value={value}>
                      {criticalityMeta(value).label}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="asset-status-filter">
                  Status
                </label>
                <select
                  id="asset-status-filter"
                  name="status"
                  defaultValue={status ?? ""}
                  className="h-8 rounded-lg border border-soc-border bg-soc-elevated px-2 text-[10px] text-soc-fg outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                >
                  <option value="">All statuses</option>
                  {ASSET_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {value === "active" ? "Active" : "Disabled"}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="asset-sort-filter">
                  Sort
                </label>
                <select
                  id="asset-sort-filter"
                  name="sort"
                  defaultValue={sort}
                  className="h-8 rounded-lg border border-soc-border bg-soc-elevated px-2 text-[10px] text-soc-fg outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                >
                  <option value="recent">Newest first</option>
                  <option value="name">Name</option>
                  <option value="risk">Highest risk</option>
                  <option value="criticality">Criticality</option>
                  <option value="last-scan">Last scan</option>
                </select>
              </div>

              {riskLevel ? (
                <input type="hidden" name="riskLevel" value={riskLevel} />
              ) : null}

              {hasFilters ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-soc-border pt-3">
                  <span className="text-[9px] uppercase tracking-[0.14em] text-soc-faint">
                    Active filters
                  </span>
                  {type ? <SocBadge tone="accent">{assetTypeLabel(type)}</SocBadge> : null}
                  {environment ? (
                    <SocBadge tone="neutral">
                      {assetEnvironmentLabel(environment)}
                    </SocBadge>
                  ) : null}
                  {criticality ? (
                    <SocBadge tone={criticalityMeta(criticality).tone}>
                      {criticalityMeta(criticality).label}
                    </SocBadge>
                  ) : null}
                  {status ? (
                    <SocBadge tone={status === "active" ? "success" : "neutral"}>
                      {status === "active" ? "Active" : "Disabled"}
                    </SocBadge>
                  ) : null}
                  {riskLevel ? (
                    <SocBadge tone={riskMeta(riskLevel).tone}>
                      {riskMeta(riskLevel).label} risk
                    </SocBadge>
                  ) : null}
                  <Link
                    href="/assets"
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
              <span className="font-semibold text-soc-fg">
                {inventory.items.length}
              </span>{" "}
              of {inventory.total} assets
            </p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-soc-faint">
              {sort === "risk" ? "Risk-ranked" : "Live inventory"}
            </p>
          </div>

          <AssetTable assets={inventory.items} canManage={canManage} />

          {totalPages > 1 ? (
            <nav
              className="flex items-center justify-between gap-3"
              aria-label="Asset pagination"
            >
              <SocLink
                href={pageHref(params, Math.max(1, inventory.page - 1))}
                variant="secondary"
                size="sm"
                ariaLabel="Previous asset page"
                className={inventory.page <= 1 ? "pointer-events-none opacity-40" : ""}
              >
                Previous
              </SocLink>
              <p className="text-[10px] text-soc-muted">
                Page {inventory.page} of {totalPages}
              </p>
              <SocLink
                href={pageHref(params, Math.min(totalPages, inventory.page + 1))}
                variant="secondary"
                size="sm"
                ariaLabel="Next asset page"
                className={
                  inventory.page >= totalPages ? "pointer-events-none opacity-40" : ""
                }
              >
                Next
              </SocLink>
            </nav>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Asset intelligence">
          <SocCard className="overflow-hidden">
            <SocCardHeader title="Recently added" description="Newest inventory entries" />
            <SocCardBody className="space-y-3">
              {dashboard.recentAssets.length === 0 ? (
                <p className="text-[10px] text-soc-muted">No assets yet.</p>
              ) : (
                dashboard.recentAssets.map((asset) => (
                  <Link
                    key={asset.id}
                    href={`/assets/${asset.id}`}
                    className="group flex items-start gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-soc-hover text-soc-muted">
                      <ServerIcon size={12} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10.5px] font-medium text-soc-fg group-hover:text-soc-accent">
                        {asset.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[9px] text-soc-faint">
                        {asset.domain} · {relativeTime(asset.createdAt)}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </SocCardBody>
          </SocCard>

          <SocCard className="overflow-hidden">
            <SocCardHeader
              title="Highest risk"
              description="Prioritize remediation by exposure"
            />
            <SocCardBody className="space-y-3">
              {dashboard.highestRiskAssets.length === 0 ? (
                <p className="text-[10px] text-soc-muted">
                  No risk data yet. Queue a scan.
                </p>
              ) : (
                dashboard.highestRiskAssets.map((asset) => (
                  <Link
                    key={asset.id}
                    href={`/assets/${asset.id}`}
                    className="group block outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[10.5px] font-medium text-soc-fg group-hover:text-soc-accent">
                        {asset.name}
                      </span>
                      <SocBadge tone={riskMeta(asset.riskLevel).tone}>
                        {asset.riskScore}
                      </SocBadge>
                    </span>
                    <span className="mt-1 block text-[9px] text-soc-faint">
                      {asset.openFindings} open findings ·{" "}
                      {asset.lastScanAt ? relativeTime(asset.lastScanAt) : "never scanned"}
                    </span>
                  </Link>
                ))
              )}
            </SocCardBody>
          </SocCard>

          <SocCard className="overflow-hidden">
            <SocCardHeader
              title="Expiring certificates"
              description="Observed within 30 days"
              action={<CertificateIcon size={15} className="text-soc-medium" />}
            />
            <SocCardBody className="space-y-3">
              {dashboard.expiringSslAssets.length === 0 ? (
                <p className="text-[10px] text-soc-muted">
                  No tracked certificates are close to expiry.
                </p>
              ) : (
                dashboard.expiringSslAssets.map((asset) => (
                  <Link
                    key={asset.id}
                    href={`/assets/${asset.id}`}
                    className="group flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-soc-medium-soft text-soc-medium">
                      <ShieldCheckIcon size={12} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10.5px] font-medium text-soc-fg group-hover:text-soc-accent">
                        {asset.name}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-soc-faint">
                        {asset.sslExpiresAt
                          ? formatDate(asset.sslExpiresAt)
                          : "Expiry unknown"}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </SocCardBody>
          </SocCard>

          <SocCard className="p-4">
            <p className="text-[10px] font-semibold text-soc-fg">
              Built for the next module
            </p>
            <p className="mt-1 text-[9.5px] leading-relaxed text-soc-muted">
              Asset records are the join point for scheduled scans, threat
              intelligence enrichment, compliance evidence and AI analysis.
            </p>
            <Link
              href="/scans/profiles"
              className={cn(
                "mt-3 inline-flex items-center gap-1 text-[9.5px] font-medium text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60",
              )}
            >
              Manage scan profiles
              <span aria-hidden="true">→</span>
            </Link>
          </SocCard>
        </aside>
      </div>
    </div>
  );
}
