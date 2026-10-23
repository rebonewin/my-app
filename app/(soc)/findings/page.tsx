import type { Metadata } from "next";
import Link from "next/link";

import { FindingsRegister } from "@/components/findings/FindingsRegister";
import { BugIcon, FilterIcon } from "@/components/ui/icons";
import { SocBadge, SocCard } from "@/components/ui/soc";
import { SocButton } from "@/components/ui/soc-button";
import { hasEffectivePermission, requirePermission } from "@/lib/auth/server";
import { tenantScope } from "@/lib/tenancy";
import { SEVERITY_META, SEVERITY_ORDER } from "@/lib/soc/severity";
import { getFindingsPageData } from "@/services/findings";
import { FINDING_STATUSES, type FindingStatus } from "@/types/findings";
import type { Severity } from "@/types/dashboard";
import { cn } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = {
  title: "Findings",
  description: "Normalized exposure register across every severity band.",
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
): "recent" | "severity" | "cvss" | "asset" | "status" {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ["recent", "severity", "cvss", "asset", "status"].includes(
    candidate ?? "",
  )
    ? (candidate as "recent" | "severity" | "cvss" | "asset" | "status")
    : "severity";
}

const statusTone: Record<FindingStatus, "danger" | "accent" | "success" | "neutral"> = {
  open: "danger",
  "in-progress": "accent",
  resolved: "success",
  "accepted-risk": "neutral",
};

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePermission("dashboard:read", {
    next: "/findings",
  });
  const scope = tenantScope(context);
  const params = await searchParams;

  const severity = findValue<Severity>(SEVERITY_ORDER, params.severity);
  const status = findValue<FindingStatus>(FINDING_STATUSES, params.status);
  const sort = sortValue(params.sort);
  const category =
    typeof params.category === "string" && params.category
      ? params.category
      : undefined;
  const assetId =
    typeof params.assetId === "string" && params.assetId
      ? params.assetId
      : undefined;
  const query = typeof params.q === "string" && params.q ? params.q : undefined;

  const data = await getFindingsPageData(scope, {
    severity,
    status,
    category,
    assetId,
    query,
    sort,
  });
  const canUpdate = hasEffectivePermission(context, "scanner:start");
  const hasFilters = Boolean(severity || status || category || assetId || query);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-soc-accent">
            Exposure register
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-soc-fg sm:text-3xl">
            Findings
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-soc-muted">
            Normalized findings persist across scans. Update remediation status
            without losing the history that produced each exposure.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/scans"
            className="inline-flex h-9 items-center rounded-xl border border-soc-border bg-soc-elevated px-3 text-[10px] font-medium text-soc-fg outline-none transition hover:bg-soc-hover focus-visible:ring-2 focus-visible:ring-soc-accent/60"
          >
            Open scan queue
          </Link>
        </div>
      </div>

      <section aria-label="Findings summary" className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <SocCard className="p-3.5">
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
            Total findings
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-soc-fg">
            {data.counts.total}
          </p>
          <p className="mt-1 text-[9px] text-soc-faint">current register</p>
        </SocCard>
        {FINDING_STATUSES.map((value) => (
          <Link
            key={value}
            href={
              value === "open" && status === "open"
                ? "/findings"
                : `/findings?status=${value}`
            }
            className="rounded-2xl border border-soc-border bg-soc-panel p-3.5 outline-none transition hover:-translate-y-0.5 hover:border-soc-border-strong hover:bg-soc-hover focus-visible:ring-2 focus-visible:ring-soc-accent/60"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                {value === "in-progress"
                  ? "In progress"
                  : value === "accepted-risk"
                    ? "Accepted risk"
                    : value.charAt(0).toUpperCase() + value.slice(1)}
              </p>
              <SocBadge tone={statusTone[value]} className="px-1.5 py-0.5 text-[8px]">
                {data.counts.status[value]}
              </SocBadge>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-soc-fg">
              {data.counts.status[value]}
            </p>
            <p className="mt-1 text-[9px] text-soc-faint">
              {value === "resolved" ? "closed out" : "in the register"}
            </p>
          </Link>
        ))}
      </section>

      <SocCard className="p-3 sm:p-4">
        <form action="/findings" method="get" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="finding-search" className="sr-only">
                Search findings
              </label>
              <input
                id="finding-search"
                name="q"
                defaultValue={query ?? ""}
                placeholder="Search title, category, asset or finding ID…"
                className="h-9 w-full rounded-lg border border-soc-border bg-soc-elevated px-3 text-[11px] text-soc-fg outline-none placeholder:text-soc-faint focus-visible:ring-2 focus-visible:ring-soc-accent/60"
              />
            </div>
            <SocButton type="submit" variant="secondary" size="sm">
              <FilterIcon size={12} />
              Search
            </SocButton>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="sr-only" htmlFor="finding-severity">
              Severity
            </label>
            <select
              id="finding-severity"
              name="severity"
              defaultValue={severity ?? ""}
              className="h-8 rounded-lg border border-soc-border bg-soc-elevated px-2 text-[10px] text-soc-fg outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
            >
              <option value="">All severities</option>
              {SEVERITY_ORDER.map((value) => (
                <option key={value} value={value}>
                  {SEVERITY_META[value].label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="finding-status">
              Status
            </label>
            <select
              id="finding-status"
              name="status"
              defaultValue={status ?? ""}
              className="h-8 rounded-lg border border-soc-border bg-soc-elevated px-2 text-[10px] text-soc-fg outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
            >
              <option value="">All statuses</option>
              {FINDING_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value === "in-progress"
                    ? "In progress"
                    : value === "accepted-risk"
                      ? "Accepted risk"
                      : value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="finding-category">
              Category
            </label>
            <select
              id="finding-category"
              name="category"
              defaultValue={category ?? ""}
              className="h-8 rounded-lg border border-soc-border bg-soc-elevated px-2 text-[10px] text-soc-fg outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
            >
              <option value="">All categories</option>
              {data.categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="finding-sort">
              Sort
            </label>
            <select
              id="finding-sort"
              name="sort"
              defaultValue={sort}
              className="h-8 rounded-lg border border-soc-border bg-soc-elevated px-2 text-[10px] text-soc-fg outline-none focus-visible:ring-2 focus-visible:ring-soc-accent/60"
            >
              <option value="severity">Severity</option>
              <option value="recent">Last seen</option>
              <option value="cvss">CVSS</option>
              <option value="asset">Asset</option>
              <option value="status">Status</option>
            </select>
          </div>

          {assetId ? <input type="hidden" name="assetId" value={assetId} /> : null}

          {hasFilters ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-soc-border pt-3">
              <span className="text-[9px] uppercase tracking-[0.14em] text-soc-faint">
                Active filters
              </span>
              {severity ? (
                <SocBadge tone={severity}>
                  {SEVERITY_META[severity].label}
                </SocBadge>
              ) : null}
              {status ? (
                <SocBadge tone={statusTone[status]}>
                  {status === "in-progress"
                    ? "In progress"
                    : status === "accepted-risk"
                      ? "Accepted risk"
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                </SocBadge>
              ) : null}
              {category ? <SocBadge tone="neutral">{category}</SocBadge> : null}
              {assetId ? <SocBadge tone="accent">Asset scoped</SocBadge> : null}
              {query ? <SocBadge tone="neutral">“{query}”</SocBadge> : null}
              <Link
                href={assetId ? `/findings?assetId=${assetId}` : "/findings"}
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
          <span className="font-semibold text-soc-fg">{data.findings.length}</span>{" "}
          findings
          {data.counts.total !== data.findings.length
            ? ` of ${data.counts.total}`
            : ""}
        </p>
        <div className="flex items-center gap-2 text-[9px] text-soc-faint">
          <BugIcon size={11} />
          Live view · status updates refresh server data
        </div>
      </div>

      <FindingsRegister findings={data.findings} canUpdate={canUpdate} />

      {data.findings.length === 0 && data.counts.total > 0 ? (
        <p className={cn("text-center text-[10px] text-soc-muted")}>
          No findings match this view. Clear the filters to see all{" "}
          {data.counts.total} findings.
        </p>
      ) : null}
    </div>
  );
}
