import type { Metadata } from "next";
import Link from "next/link";

import { FindingsTable } from "@/components/dashboard/FindingsTable";
import { FilterIcon, PlusIcon } from "@/components/ui/icons";
import { SocBadge, SocCard } from "@/components/ui/soc";
import { SocButton, SocLink } from "@/components/ui/soc-button";
import { requirePermission } from "@/lib/auth/server";
import { SEVERITY_META, SEVERITY_ORDER } from "@/lib/soc/severity";
import { getFindingCounts, getFindings } from "@/services/dashboard";
import type { Severity } from "@/types/dashboard";
import { cn } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = {
  title: "Findings",
  description: "Filtered exposure register across every severity band.",
};

function parseSeverity(value: string | string[] | undefined): Severity | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return SEVERITY_ORDER.find((severity) => severity === candidate);
}

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("dashboard:read", { next: "/findings" });
  const params = await searchParams;
  const severity = parseSeverity(params.severity);
  const query = typeof params.q === "string" ? params.q : undefined;

  const [findings, counts] = await Promise.all([
    getFindings({ severity, query }),
    getFindingCounts(),
  ]);
  const total = SEVERITY_ORDER.reduce(
    (sum, key) => sum + counts[key],
    0,
  );

  const tabs = [
    { key: undefined, label: "All", count: total, href: "/findings" },
    ...SEVERITY_ORDER.map((key) => ({
      key,
      label: SEVERITY_META[key].label,
      count: counts[key],
      href: `/findings?severity=${key}`,
    })),
  ];

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
            Every open exposure, ranked by severity and grounded in the latest
            scanner evidence. Filter by band to focus remediation.
          </p>
        </div>
        <SocLink href="/scanner" variant="primary" size="md">
          <PlusIcon size={14} />
          Run new scan
        </SocLink>
      </div>

      <SocCard className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((tab) => {
              const active = tab.key === severity;
              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-soc-accent/60",
                    active
                      ? "border-soc-accent/30 bg-soc-accent-soft text-soc-accent"
                      : "border-transparent text-soc-muted hover:bg-soc-hover hover:text-soc-fg",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 text-[9px] tabular-nums",
                      active
                        ? "bg-soc-accent/15 text-soc-accent"
                        : "bg-soc-hover text-soc-faint",
                    )}
                  >
                    {tab.count}
                  </span>
                </Link>
              );
            })}
          </div>

          <form
            action="/findings"
            method="get"
            className="flex items-center gap-2"
          >
            {severity ? (
              <input type="hidden" name="severity" value={severity} />
            ) : null}
            <label htmlFor="finding-search" className="sr-only">
              Search findings
            </label>
            <input
              id="finding-search"
              name="q"
              defaultValue={query ?? ""}
              placeholder="Search CVE, target, category…"
              className="h-8 w-full min-w-0 rounded-lg border border-soc-border bg-soc-elevated px-2.5 text-[10px] text-soc-fg outline-none placeholder:text-soc-faint focus-visible:ring-2 focus-visible:ring-soc-accent/60 sm:w-56"
            />
            <SocButton type="submit" variant="secondary" size="sm">
              <FilterIcon size={12} />
              Filter
            </SocButton>
          </form>
        </div>

        {severity || query ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-soc-border pt-3">
            <span className="text-[9px] uppercase tracking-[0.14em] text-soc-faint">
              Active filters
            </span>
            {severity ? (
              <SocBadge tone={severity}>{SEVERITY_META[severity].label}</SocBadge>
            ) : null}
            {query ? <SocBadge tone="neutral">“{query}”</SocBadge> : null}
            <Link
              href="/findings"
              className="text-[9px] font-medium text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
            >
              Clear
            </Link>
          </div>
        ) : null}
      </SocCard>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] text-soc-muted">
          Showing <span className="font-semibold text-soc-fg">{findings.length}</span>{" "}
          of {severity ? counts[severity] : total} findings
        </p>
        <p className="text-[9px] uppercase tracking-[0.14em] text-soc-faint">
          Demo evidence · replace via service
        </p>
      </div>

      <FindingsTable findings={findings} />
    </div>
  );
}
