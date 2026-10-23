import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetDangerActions } from "@/components/assets/AssetDangerActions";
import { SeverityTrend } from "@/components/assets/SeverityTrend";
import { ScoreTrendChart } from "@/components/charts/ScoreTrendChart";
import { ScanLauncher } from "@/components/scans/ScanLauncher";
import {
  ArrowRightIcon,
  CertificateIcon,
  EditIcon,
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
  SocProgress,
} from "@/components/ui/soc";
import { SocLink } from "@/components/ui/soc-button";
import {
  hasEffectivePermission,
  requirePermission,
} from "@/lib/auth/server";
import {
  assetEnvironmentLabel,
  assetTypeLabel,
  criticalityMeta,
  riskMeta,
} from "@/lib/soc/assets";
import { FINDING_STATUS_META } from "@/lib/soc/findings";
import { scanDuration, scanStatusMeta } from "@/lib/soc/scans";
import { SEVERITY_META } from "@/lib/soc/severity";
import { formatDate, relativeTime } from "@/lib/utils";
import { tenantScope } from "@/lib/tenancy";
import { getAssetDetail } from "@/services/assets";
import { listScanProfiles } from "@/services/scanner/profiles";
import type { Severity } from "@/types/dashboard";
import type { FindingStatus } from "@/types/findings";

export const instant = false;

export const metadata: Metadata = {
  title: "Asset detail",
  description: "Asset posture, scan history, findings and certificate trend.",
};

function scoreForScan(score: number, riskScore: number): number {
  return score > 0 ? score : Math.max(0, 100 - riskScore);
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("scanner:read");
  const scope = tenantScope(context);
  const { id } = await params;

  const [detail, profiles] = await Promise.all([
    getAssetDetail(scope, id),
    listScanProfiles(scope),
  ]);
  if (!detail) notFound();

  const { asset, scans, findings, sslHistory } = detail;
  const canStart = hasEffectivePermission(context, "scanner:start");
  const canDelete = hasEffectivePermission(context, "scanner:delete");
  const criticality = criticalityMeta(asset.criticality);
  const risk = riskMeta(asset.riskLevel);
  const latestSsl = sslHistory[0];
  const completedScans = scans
    .filter((scan) => scan.status === "completed")
    .reverse();
  const trend = completedScans.map((scan) => ({
    label: new Intl.DateTimeFormat("en-GB", {
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    }).format(new Date(scan.createdAt)),
    score: scoreForScan(scan.securityScore, scan.riskScore),
    scans: Math.max(1, scan.findingCount),
  }));

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/assets"
            className="text-[10px] font-medium text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
          >
            ← Asset inventory
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-[-0.03em] text-soc-fg sm:text-3xl">
              {asset.name}
            </h1>
            <SocBadge tone={risk.tone}>{risk.label} risk</SocBadge>
            <SocBadge tone={asset.status === "active" ? "success" : "neutral"}>
              {asset.status === "active" ? "Active" : "Disabled"}
            </SocBadge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-soc-muted">
            <a
              href={asset.targetUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex max-w-full items-center gap-1 truncate font-mono text-soc-muted outline-none hover:text-soc-accent focus-visible:ring-2 focus-visible:ring-soc-accent/60"
            >
              {asset.targetUrl}
              <ExternalLinkIcon size={10} />
            </a>
            <span className="text-soc-faint">·</span>
            <span>{assetTypeLabel(asset.type)}</span>
            <span className="text-soc-faint">·</span>
            <span>{assetEnvironmentLabel(asset.environment)}</span>
            {asset.owner ? (
              <>
                <span className="text-soc-faint">·</span>
                <span>{asset.owner}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasEffectivePermission(context, "scanner:start") ? (
            <SocLink
              href={`/assets/${asset.id}/edit`}
              variant="secondary"
              size="md"
            >
              <EditIcon size={14} />
              Edit
            </SocLink>
          ) : null}
          {canDelete ? (
            <AssetDangerActions assetId={asset.id} assetName={asset.name} />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <SocCard className="p-3.5">
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
            Risk score
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-soc-fg">
            {asset.riskScore}
            <span className="text-[10px] font-normal text-soc-faint">/100</span>
          </p>
          <SocProgress
            value={asset.riskScore}
            tone={
              asset.riskLevel === "critical"
                ? "danger"
                : asset.riskLevel === "high"
                  ? "warning"
                  : "success"
            }
            className="mt-2"
            label="Asset risk score"
          />
        </SocCard>
        <SocCard className="p-3.5">
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
            Open findings
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-soc-fg">
            {asset.openFindings}
          </p>
          <p className="mt-2 text-[9px] text-soc-faint">
            {findings.filter((finding) => finding.severity === "critical").length}{" "}
            critical in total
          </p>
        </SocCard>
        <SocCard className="p-3.5">
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
            Last scan
          </p>
          <p className="mt-2 text-[13px] font-semibold text-soc-fg">
            {asset.lastScanAt ? relativeTime(asset.lastScanAt) : "Never"}
          </p>
          <p className="mt-2 text-[9px] text-soc-faint">
            {asset.lastScanAt ? formatDate(asset.lastScanAt) : "No baseline yet"}
          </p>
        </SocCard>
        <SocCard className="p-3.5">
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
            Certificate
          </p>
          <p className="mt-2 text-[13px] font-semibold text-soc-fg">
            {latestSsl?.daysRemaining != null
              ? `${latestSsl.daysRemaining} days`
              : "Not observed"}
          </p>
          <p className="mt-2 text-[9px] text-soc-faint">
            {latestSsl?.issuer ?? "Queue a TLS audit"}
          </p>
        </SocCard>
        <SocCard className="col-span-2 p-3.5 lg:col-span-1">
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
            Business criticality
          </p>
          <p className="mt-2">
            <SocBadge tone={criticality.tone}>{criticality.label}</SocBadge>
          </p>
          <p className="mt-2 text-[9px] text-soc-faint">
            {asset.tags.length ? asset.tags.join(" · ") : "No tags"}
          </p>
        </SocCard>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_332px]">
        <div className="min-w-0 space-y-4">
          <SocCard className="overflow-hidden">
            <SocCardHeader
              title="Security score trend"
              description="Derived from completed scans against this asset"
              action={
                <Link
                  href={`/scans?assetId=${asset.id}`}
                  className="text-[10px] font-medium text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                >
                  All scans
                </Link>
              }
            />
            <SocCardBody>
              <ScoreTrendChart data={trend} />
            </SocCardBody>
          </SocCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SocCard className="overflow-hidden">
              <SocCardHeader
                title="Severity trend"
                description="Findings introduced across the last eight scans"
              />
              <SocCardBody>
                <SeverityTrend scans={scans} />
              </SocCardBody>
            </SocCard>

            <SocCard className="overflow-hidden">
              <SocCardHeader
                title="SSL history"
                description="Certificate observations from TLS-aware scans"
                action={<CertificateIcon size={15} className="text-soc-medium" />}
              />
              <SocCardBody className="space-y-3">
                {sslHistory.length === 0 ? (
                  <SocEmptyState
                    icon={<CertificateIcon size={16} />}
                    title="No certificate history"
                    description="Run an SSL Audit or Full Scan to start tracking expiry."
                  />
                ) : (
                  sslHistory.slice(0, 5).map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="flex items-start justify-between gap-3 border-b border-soc-border pb-2.5 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-medium text-soc-fg">
                          {snapshot.issuer ?? "Unknown issuer"}
                        </p>
                        <p className="mt-0.5 text-[9px] text-soc-faint">
                          {snapshot.protocol ?? "Unknown protocol"} ·{" "}
                          {snapshot.validTo
                            ? `expires ${formatDate(snapshot.validTo)}`
                            : "no expiry"}
                        </p>
                      </div>
                      <SocBadge
                        tone={
                          (snapshot.daysRemaining ?? 999) <= 30
                            ? "medium"
                            : "success"
                        }
                      >
                        {snapshot.daysRemaining ?? "?"}d
                      </SocBadge>
                    </div>
                  ))
                )}
              </SocCardBody>
            </SocCard>
          </div>

          <SocCard className="overflow-hidden">
            <SocCardHeader
              title="Scan history"
              description="Every assessment retains its profile, evidence and comparison"
              action={
                <SocLink href={`/scans?assetId=${asset.id}`} size="sm">
                  Queue view
                </SocLink>
              }
            />
            {scans.length === 0 ? (
              <SocEmptyState
                icon={<RadarIcon size={18} />}
                title="No scans yet"
                description="Queue a profile to establish the first baseline."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead>
                    <tr className="border-b border-soc-border text-[8px] uppercase tracking-[0.14em] text-soc-faint">
                      <th className="px-4 py-2.5 font-semibold sm:px-5">Date</th>
                      <th className="px-3 py-2.5 font-semibold">Profile</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-3 py-2.5 font-semibold">Risk</th>
                      <th className="px-3 py-2.5 font-semibold">Findings</th>
                      <th className="px-4 py-2.5 text-right font-semibold sm:px-5">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-soc-border">
                    {scans.map((scan) => (
                      <tr key={scan.id} className="transition hover:bg-soc-hover/40">
                        <td className="px-4 py-3 text-[10px] text-soc-muted sm:px-5">
                          <Link
                            href={`/scans/${scan.id}`}
                            className="outline-none hover:text-soc-accent focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                          >
                            {formatDate(scan.createdAt)}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-[10px] text-soc-muted">
                          {scan.profileName ?? "Standalone"}
                        </td>
                        <td className="px-3 py-3">
                          <SocBadge tone={scanStatusMeta(scan.status).tone}>
                            {scanStatusMeta(scan.status).label}
                          </SocBadge>
                        </td>
                        <td className="px-3 py-3 text-[10px] tabular-nums text-soc-muted">
                          {scan.riskScore}/100
                        </td>
                        <td className="px-3 py-3 text-[10px] text-soc-muted">
                          {scan.findingCount}
                          {scan.criticalCount ? (
                            <span className="ml-1 text-soc-critical">
                              ({scan.criticalCount}C)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right text-[10px] text-soc-muted sm:px-5">
                          <Link
                            href={`/scans/${scan.id}`}
                            className="inline-flex items-center gap-1 outline-none hover:text-soc-accent focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                          >
                            {scan.durationMs != null
                              ? scanDuration(scan.durationMs)
                              : "—"}
                            <ArrowRightIcon size={10} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SocCard>

          <SocCard className="overflow-hidden">
            <SocCardHeader
              title="Findings history"
              description="Current normalized findings for this asset"
              action={
                <Link
                  href={`/findings?assetId=${asset.id}`}
                  className="text-[10px] font-medium text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                >
                  Open register
                </Link>
              }
            />
            {findings.length === 0 ? (
              <SocEmptyState
                icon={<ShieldCheckIcon size={18} />}
                title="No findings recorded"
                description="The latest evidence did not normalize any exposures."
              />
            ) : (
              <ul className="divide-y divide-soc-border">
                {findings.slice(0, 8).map((finding) => (
                  <li
                    key={finding.id}
                    className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SocBadge tone={finding.severity as Severity}>
                          {SEVERITY_META[finding.severity as Severity].label}
                        </SocBadge>
                        <p className="truncate text-[10.5px] font-medium text-soc-fg">
                          {finding.title}
                        </p>
                      </div>
                      <p className="mt-1 text-[9px] text-soc-faint">
                        {finding.category} · first seen{" "}
                        {relativeTime(finding.firstSeenAt)}
                      </p>
                    </div>
                    <SocBadge
                      tone={
                        FINDING_STATUS_META[finding.status as FindingStatus].tone
                      }
                    >
                      {
                        FINDING_STATUS_META[finding.status as FindingStatus]
                          .label
                      }
                    </SocBadge>
                  </li>
                ))}
              </ul>
            )}
          </SocCard>
        </div>

        <aside className="space-y-4" aria-label="Asset actions and metadata">
          <ScanLauncher
            assets={[
              {
                id: asset.id,
                name: asset.name,
                targetUrl: asset.targetUrl,
                criticality: asset.criticality,
              },
            ]}
            profiles={profiles}
            defaultAssetId={asset.id}
            canStart={canStart}
          />

          <SocCard className="overflow-hidden">
            <SocCardHeader title="Asset metadata" />
            <SocCardBody className="space-y-3">
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                  Domain
                </p>
                <p className="mt-1 font-mono text-[10px] text-soc-fg">
                  {asset.domain}
                </p>
              </div>
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                  Resolved IP
                </p>
                <p className="mt-1 font-mono text-[10px] text-soc-fg">
                  {asset.ipAddress ?? "Not resolved"}
                </p>
              </div>
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                  Registered
                </p>
                <p className="mt-1 text-[10px] text-soc-fg">
                  {formatDate(asset.createdAt)}
                </p>
              </div>
              {asset.description ? (
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                    Description
                  </p>
                  <p className="mt-1 whitespace-pre-line text-[10px] leading-relaxed text-soc-muted">
                    {asset.description}
                  </p>
                </div>
              ) : null}
            </SocCardBody>
          </SocCard>

          <SocCard className="p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-soc-accent-soft text-soc-accent">
                <RadarIcon size={14} />
              </span>
              <div>
                <p className="text-[10px] font-semibold text-soc-fg">
                  Scan comparison
                </p>
                <p className="text-[9px] text-soc-faint">
                  Compare any completed run with the previous baseline
                </p>
              </div>
            </div>
            <p className="mt-2.5 text-[9.5px] leading-relaxed text-soc-muted">
              Open a completed scan to see introduced and resolved findings,
              score delta and severity movement.
            </p>
            {scans[0] ? (
              <SocLink
                href={`/scans/${scans[0].id}`}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                Open latest scan
                <ArrowRightIcon size={11} />
              </SocLink>
            ) : null}
          </SocCard>
        </aside>
      </div>
    </div>
  );
}
