"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { RadarIcon } from "@/components/ui/icons";
import { SocButton } from "@/components/ui/soc-button";
import { SocCard, SocCardBody, SocCardHeader } from "@/components/ui/soc";
import type { AssetSelectOption } from "@/types/assets";
import type { ScanProfileSummary } from "@/types/scanner";

const fieldClass =
  "h-10 w-full rounded-xl border border-soc-border bg-soc-elevated px-3 text-xs text-soc-fg outline-none transition focus-visible:border-soc-accent/50 focus-visible:ring-2 focus-visible:ring-soc-accent/50";

export function ScanLauncher({
  assets,
  profiles,
  defaultAssetId,
  canStart,
}: {
  assets: AssetSelectOption[];
  profiles: ScanProfileSummary[];
  defaultAssetId?: string;
  canStart: boolean;
}) {
  const router = useRouter();
  const [assetId, setAssetId] = useState(defaultAssetId ?? assets[0]?.id ?? "");
  const [profileId, setProfileId] = useState("system-standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function queueScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canStart || !assetId || loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId, profileId }),
      });
      const data = (await response.json().catch(() => null)) as
        | { scan?: { id: string }; error?: string }
        | null;

      if (!response.ok || !data?.scan) {
        setError(data?.error ?? "The scan could not be queued.");
        return;
      }

      router.push(`/scans/${data.scan.id}`);
      router.refresh();
    } catch {
      setError("Network error while queueing the scan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SocCard className="overflow-hidden">
      <SocCardHeader
        title="Queue a scan"
        description="Choose an active asset and a reusable profile. The queue updates live."
      />
      <SocCardBody className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}

        {assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-soc-border px-4 py-5 text-center">
            <p className="text-xs font-medium text-soc-fg">No active assets yet</p>
            <p className="mt-1 text-[10px] text-soc-muted">
              Register an asset before launching a scan.
            </p>
            <Link
              href="/assets/new"
              className="mt-3 inline-flex text-[10px] font-semibold text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
            >
              Register an asset
            </Link>
          </div>
        ) : (
          <form onSubmit={queueScan} className="space-y-3">
            <div>
              <label
                htmlFor="queue-asset"
                className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-soc-faint"
              >
                Asset
              </label>
              <select
                id="queue-asset"
                value={assetId}
                onChange={(event) => setAssetId(event.target.value)}
                className={fieldClass}
                disabled={Boolean(defaultAssetId) || loading}
              >
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} · {asset.targetUrl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="queue-profile"
                className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-soc-faint"
              >
                Scan profile
              </label>
              <select
                id="queue-profile"
                value={profileId}
                onChange={(event) => setProfileId(event.target.value)}
                className={fieldClass}
                disabled={loading}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.isSystem ? "" : " (custom)"}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[9px] leading-relaxed text-soc-faint">
                {
                  profiles.find((profile) => profile.id === profileId)
                    ?.description
                }
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-soc-border pt-3">
              <p className="text-[9px] text-soc-faint">
                Private and metadata targets are blocked before any connection.
              </p>
              <SocButton
                type="submit"
                size="sm"
                disabled={!canStart || loading || !assetId}
              >
                <RadarIcon size={13} />
                {loading ? "Queueing…" : "Queue scan"}
              </SocButton>
            </div>

            {!canStart ? (
              <p className="text-[9px] text-soc-medium">
                Your role can view the queue but cannot start scans.
              </p>
            ) : null}
          </form>
        )}
      </SocCardBody>
    </SocCard>
  );
}
