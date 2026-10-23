import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ScanResultView from "@/components/scanner/ScanResultView";
import { ScanProgressLive } from "@/components/scans/ScanProgressLive";
import {
  ArrowRightIcon,
  CertificateIcon,
  ExternalLinkIcon,
  RadarIcon,
  ShieldCheckIcon,
} from "@/components/ui/icons";
import {
  SocBadge,
  SocCard,
  SocCardBody,
  SocCardHeader,
  SocEmptyState,
} from "@/components/ui/soc";
import { SocLink } from "@/components/ui/soc-button";
import { requirePermission } from "@/lib/auth/server";
import { scanStatusMeta } from "@/lib/soc/scans";
import { SCAN_MODULE_LABELS } from "@/types/scanner";
import { SEVERITY_META } from "@/lib/soc/severity";
import { FINDING_STATUS_META } from "@/lib/soc/findings";
import { formatDate, relativeTime } from "@/lib/utils";
import { tenantScope } from "@/lib/tenancy";
import {
  getScanDetail,
  getScanResult,
} from "@/services/scanner/scans";
import type { Severity } from "@/types/dashboard";
import type { FindingStatus } from "@/types/findings";
import type { ScanModule } from "@/types/scanner";

export const instant = false;

export const metadata: Metadata = {
  title: "Scan detail",
  description:
    "Queue progress, passive evidence, normalized findings and baseline comparison.",
};

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("scanner:read");
  const scope = tenantScope(context);
  const { id } = await params;

  const [detail, result] = await Promise.all([
    getScanDetail(scope, id),
    getScanResult(scope, id),
  ]);
  if (!detail) notFound();

  const { scan, findings, ssl, comparison } = detail;
  const meta = scanStatusMeta(scan.status);
  const scoreDelta = comparison?.scoreDelta ?? null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            href={scan.assetId ? `/assets/${scan.assetId}` : "/scans"}
            className="text-[10px] font-medium text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
          >
            ← {scan.assetId ? "Asset detail" : "Scan queue"}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-[-0.03em] text-soc-fg sm:text-3xl">
              {scan.assetName ?? scan.target}
            </h1>
            <SocBadge tone={meta.tone}>{meta.label}</SocBadge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-soc-muted">
            <a
              href={scan.target}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex max-w-full items-center gap-1 truncate font-mono text-soc-muted outline-none hover:text-soc-accent focus-visible:ring-2 focus-visible:ring-soc-accent/60"
            >
              {scan.target}
              <ExternalLinkIcon size={10} />
            </a>
            <span className="text-soc-faint">·</span>
            <span>{scan.profileName ?? "Standalone scan"}</span>
            <span className="text-soc-faint">·</span>
            <span>{formatDate(scan.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {scan.assetId ? (
            <SocLink
              href={`/assets/${scan.assetId}`}
              variant="secondary"
              size="md"
            >
              <RadarIcon size={14} />
              Asset
            </SocLink>
          ) : null}
          <SocLink href="/findings" variant="secondary" size="md">
            Findings register
            <ArrowRightIcon size={13} />
          </SocLink>
        </div>
      </div>

      <ScanProgressLive initialScan={scan} />

      {comparison ? (
        <SocCard className="overflow-hidden">
          <SocCardHeader
            title="Comparison with previous scan"
            description={`Baseline ${formatDate(
              scan.createdAt,
            )} vs ${comparison.baselineId.slice(0, 8)}`}
            action={
              <SocLink
                href={`/scans/${comparison.baselineId}`}
                variant="secondary"
                size="sm"
              >
                Open baseline
              </SocLink>
            }
          />
          <SocCardBody className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-soc-border bg-soc-elevated/40 p-3">
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                  Score delta
                </p>
                <p
                  className={`mt-1 text-xl font-semibold tabular-nums ${
                    scoreDelta !== null && scoreDelta >= 0
                      ? "text-soc-success"
                      : "text-soc-critical"
                  }`}
                >
                  {scoreDelta !== null && scoreDelta > 0 ? "+" : ""}
                  {scoreDelta ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border border-soc-border bg-soc-elevated/40 p-3">
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                  New findings
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-soc-fg">
                  {comparison.introduced.length}
                </p>
              </div>
              <div className="rounded-xl border border-soc-border bg-soc-elevated/40 p-3">
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                  Resolved
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-soc-fg">
                  {comparison.resolved.length}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                  Introduced in this scan
                </p>
                {comparison.introduced.length === 0 ? (
                  <p className="text-[10px] text-soc-muted">
                    No new exposures compared with the baseline.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {comparison.introduced.map((item) => (
                      <li
                        key={item.fingerprint}
                        className="flex items-center gap-2 rounded-lg bg-soc-elevated/40 px-2.5 py-2"
                      >
                        <SocBadge tone={item.severity as Severity}>
                          {SEVERITY_META[item.severity as Severity]?.label ??
                            item.severity}
                        </SocBadge>
                        <span className="min-w-0 flex-1 truncate text-[10px] text-soc-fg">
                          {item.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                  No longer detected
                </p>
                {comparison.resolved.length === 0 ? (
                  <p className="text-[10px] text-soc-muted">
                    No findings disappeared between the two scans.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {comparison.resolved.map((item) => (
                      <li
                        key={item.fingerprint}
                        className="flex items-center gap-2 rounded-lg bg-soc-elevated/40 px-2.5 py-2"
                      >
                        <SocBadge tone="success">Resolved</SocBadge>
                        <span className="min-w-0 flex-1 truncate text-[10px] text-soc-fg">
                          {item.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </SocCardBody>
        </SocCard>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_318px]">
        <div className="min-w-0 space-y-4">
          {result ? (
            <SocCard className="overflow-hidden">
              <SocCardHeader
                title="Evidence bundle"
                description="Passive response, headers, TLS and exposure observations"
              />
              <SocCardBody>
                <ScanResultView result={result} />
              </SocCardBody>
            </SocCard>
          ) : (
            <SocCard>
              <SocEmptyState
                icon={<RadarIcon size={18} />}
                title={
                  scan.status === "completed"
                    ? "No evidence bundle stored"
                    : "Evidence is not available yet"
                }
                description={
                  scan.status === "completed"
                    ? "This scan completed without a serializable result payload."
                    : "The evidence bundle appears here as soon as the worker finishes."
                }
              />
            </SocCard>
          )}

          <SocCard className="overflow-hidden">
            <SocCardHeader
              title="Findings snapshot"
              description="What this scan observed at the time it ran"
            />
            {findings.length === 0 ? (
              <SocEmptyState
                icon={<ShieldCheckIcon size={18} />}
                title="No findings in this snapshot"
                description="The profile did not normalize any exposures for this run."
              />
            ) : (
              <ul className="divide-y divide-soc-border">
                {findings.map((finding) => (
                  <li
                    key={finding.fingerprint}
                    className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SocBadge tone={finding.severity as Severity}>
                          {SEVERITY_META[finding.severity as Severity]?.label ??
                            finding.severity}
                        </SocBadge>
                        <p className="text-[10.5px] font-medium text-soc-fg">
                          {finding.title}
                        </p>
                      </div>
                      <p className="mt-1 text-[9px] text-soc-faint">
                        {finding.category} · CVSS {finding.cvss.toFixed(1)}
                      </p>
                    </div>
                    <SocBadge
                      tone={
                        FINDING_STATUS_META[finding.status as FindingStatus]
                          ?.tone ?? "neutral"
                      }
                    >
                      {FINDING_STATUS_META[finding.status as FindingStatus]
                        ?.label ?? finding.status}
                    </SocBadge>
                  </li>
                ))}
              </ul>
            )}
          </SocCard>
        </div>

        <aside className="space-y-4" aria-label="Scan metadata">
          <SocCard className="overflow-hidden">
            <SocCardHeader title="Run metadata" />
            <SocCardBody className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-soc-faint">Status</span>
                <SocBadge tone={meta.tone}>{meta.label}</SocBadge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-soc-faint">Queued</span>
                <span className="text-[10px] text-soc-muted">
                  {relativeTime(scan.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-soc-faint">Started</span>
                <span className="text-[10px] text-soc-muted">
                  {scan.startedAt ? formatDate(scan.startedAt) : "Waiting"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-soc-faint">Completed</span>
                <span className="text-[10px] text-soc-muted">
                  {scan.completedAt ? formatDate(scan.completedAt) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-soc-faint">Risk score</span>
                <span className="text-[10px] tabular-nums text-soc-fg">
                  {scan.riskScore}/100 ({scan.riskLevel})
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-soc-faint">Security score</span>
                <span className="text-[10px] tabular-nums text-soc-fg">
                  {scan.securityScore}/100
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-soc-faint">Findings</span>
                <span className="text-[10px] tabular-nums text-soc-fg">
                  {scan.findingCount}
                </span>
              </div>
            </SocCardBody>
          </SocCard>

          <SocCard className="overflow-hidden">
            <SocCardHeader
              title="Profile modules"
              description={scan.profileName ?? "Standalone scan"}
            />
            <SocCardBody>
              <div className="flex flex-wrap gap-1.5">
                {scan.profileModules.length === 0 ? (
                  <p className="text-[10px] text-soc-muted">No modules recorded.</p>
                ) : (
                  scan.profileModules.map((module) => (
                    <span
                      key={module}
                      className="rounded-md bg-soc-hover px-1.5 py-1 text-[8px] font-medium uppercase tracking-[0.08em] text-soc-muted"
                    >
                      {SCAN_MODULE_LABELS[module as ScanModule] ?? module}
                    </span>
                  ))
                )}
              </div>
            </SocCardBody>
          </SocCard>

          <SocCard className="overflow-hidden">
            <SocCardHeader
              title="Certificate"
              description="Observed during this run"
              action={<CertificateIcon size={15} className="text-soc-medium" />}
            />
            <SocCardBody className="space-y-2.5">
              {ssl ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-soc-faint">Issuer</span>
                    <span className="max-w-[65%] truncate text-right text-[10px] text-soc-fg">
                      {ssl.issuer ?? "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-soc-faint">Protocol</span>
                    <span className="text-[10px] text-soc-fg">
                      {ssl.protocol ?? "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-soc-faint">Expires</span>
                    <span className="text-[10px] text-soc-fg">
                      {ssl.validTo ? formatDate(ssl.validTo) : "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-soc-faint">Days left</span>
                    <SocBadge
                      tone={
                        (ssl.daysRemaining ?? 999) <= 30 ? "medium" : "success"
                      }
                    >
                      {ssl.daysRemaining ?? "?"}d
                    </SocBadge>
                  </div>
                </>
              ) : (
                <p className="text-[10px] text-soc-muted">
                  This profile did not include a TLS observation.
                </p>
              )}
            </SocCardBody>
          </SocCard>
        </aside>
      </div>
    </div>
  );
}
