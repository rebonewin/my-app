import type { Metadata } from "next";

import { ScanProfileManager } from "@/components/scans/ScanProfileManager";
import {
  RadarIcon,
  SettingsIcon,
  ShieldCheckIcon,
} from "@/components/ui/icons";
import {
  SocBadge,
  SocCard,
  SocCardBody,
  SocCardHeader,
} from "@/components/ui/soc";
import { SocLink } from "@/components/ui/soc-button";
import { hasEffectivePermission, requirePermission } from "@/lib/auth/server";
import { tenantScope } from "@/lib/tenancy";
import { listScanProfiles } from "@/services/scanner/profiles";

export const instant = false;

export const metadata: Metadata = {
  title: "Scan profiles",
  description:
    "Review built-in assessments and build reusable custom scan profiles.",
};

export default async function ScanProfilesPage() {
  const context = await requirePermission("scanner:read", {
    next: "/scans/profiles",
  });
  const scope = tenantScope(context);
  const profiles = await listScanProfiles(scope);
  const canManage = hasEffectivePermission(context, "scanner:configure");
  const customCount = profiles.filter((profile) => !profile.isSystem).length;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-soc-accent">
            Orchestration
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-soc-fg sm:text-3xl">
            Scan profiles
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-soc-muted">
            Profiles are reusable module sets. Every queued scan snapshots its
            profile so editing a profile never rewrites scan history.
          </p>
        </div>
        <div className="flex gap-2">
          <SocLink href="/scans" variant="secondary" size="md">
            <RadarIcon size={14} />
            Scan queue
          </SocLink>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SocCard className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-soc-faint">
              Built-in profiles
            </p>
            <ShieldCheckIcon size={14} className="text-soc-accent" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-soc-fg">
            {profiles.length - customCount}
          </p>
          <p className="mt-1 text-[10px] text-soc-muted">
            Maintained with the scanner
          </p>
        </SocCard>
        <SocCard className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-soc-faint">
              Custom profiles
            </p>
            <SettingsIcon size={14} className="text-soc-violet" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-soc-fg">
            {customCount}
          </p>
          <p className="mt-1 text-[10px] text-soc-muted">
            Scoped to this workspace
          </p>
        </SocCard>
        <SocCard className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-soc-faint">
              Your access
            </p>
            <SocBadge tone={canManage ? "success" : "neutral"}>
              {canManage ? "Can manage" : "Read only"}
            </SocBadge>
          </div>
          <p className="mt-2 text-sm font-semibold text-soc-fg">
            {canManage ? "Profile configuration" : "Profile visibility"}
          </p>
          <p className="mt-1 text-[10px] text-soc-muted">
            Requires the scanner configure permission
          </p>
        </SocCard>
      </div>

      <ScanProfileManager profiles={profiles} canManage={canManage} />

      <SocCard className="overflow-hidden">
        <SocCardHeader
          title="Built for scheduled scans"
          description="Profiles are the stable unit a scheduler, compliance policy or AI workflow can target."
        />
        <SocCardBody className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold text-soc-fg">
              Immutable snapshots
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-soc-muted">
              Profile name and modules are copied onto each scan at enqueue
              time.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-soc-fg">
              Tenant scoped
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-soc-muted">
              Custom profiles follow the active organization or personal
              workspace.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-soc-fg">
              Safe evolution
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-soc-muted">
              Built-in profiles can evolve with the engine without a database
              migration.
            </p>
          </div>
        </SocCardBody>
      </SocCard>
    </div>
  );
}
