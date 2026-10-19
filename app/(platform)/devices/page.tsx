import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import { DevicesManager, type DeviceRow } from "@/components/security/DevicesManager";
import {
  Card,
  CardBody,
  EmptyState,
  StatTile,
} from "@/components/ui/card";
import { MonitorIcon, ShieldIcon, SmartphoneIcon } from "@/components/ui/icons";
import { requirePermission } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { device, session } from "@/lib/db/schema";

export const instant = false;

export const metadata = {
  title: "Devices · 1Security",
};

export default async function DevicesPage() {
  const context = await requirePermission("device:read", { next: "/devices" });

  const rows = await db
    .select({
      id: device.id,
      name: device.name,
      browser: device.browser,
      os: device.os,
      deviceType: device.deviceType,
      trusted: device.trusted,
      trustedUntil: device.trustedUntil,
      lastIp: device.lastIp,
      lastCountry: device.lastCountry,
      lastCity: device.lastCity,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
      sessionCount: sql<number>`(
        select count(*)::int from ${session}
        where ${session.deviceId} = ${device.id}
          and ${session.expiresAt} > now()
      )`,
    })
    .from(device)
    .where(and(eq(device.userId, context.user.id), isNull(device.revokedAt)))
    .orderBy(sql`${device.lastSeenAt} desc`);

  // Guard against an empty device table for accounts created before device
  // binding existed: fall back to synthesising rows from live sessions.
  const liveSessions = await db
    .select({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
    })
    .from(session)
    .where(
      and(
        eq(session.userId, context.user.id),
        gt(session.expiresAt, new Date()),
        isNull(session.deviceId),
      ),
    );

  const devices: DeviceRow[] = rows.map((row) => ({
    ...row,
    trustedUntil: row.trustedUntil?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));

  const trusted = devices.filter((entry) => entry.trusted).length;

  return (
    <div>
      <PageHeader
        eyebrow="Identity"
        title="Devices"
        description="Device binding lets you cut off a stolen laptop or an unknown phone without touching your other sessions."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Known devices"
          value={devices.length}
          tone="cyan"
          icon={<MonitorIcon size={16} />}
        />
        <StatTile
          label="Trusted"
          value={trusted}
          tone={trusted > 0 ? "green" : "neutral"}
          icon={<ShieldIcon size={16} />}
        />
        <StatTile
          label="Unbound sessions"
          value={liveSessions.length}
          hint="Created before device binding"
          tone={liveSessions.length > 0 ? "amber" : "green"}
          icon={<SmartphoneIcon size={16} />}
        />
      </div>

      <Card>
        <CardBody>
          {devices.length === 0 ? (
            <EmptyState
              icon={<MonitorIcon size={20} />}
              title="No devices registered yet"
              description="Devices are registered automatically on your next sign-in. Sign out and back in to populate this view."
            />
          ) : (
            <DevicesManager
              devices={devices}
              canManage={context.permissions.has("device:revoke")}
            />
          )}
        </CardBody>
      </Card>

      {liveSessions.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4">
          <p className="text-xs font-medium text-amber-200">
            {liveSessions.length} session(s) are not device-bound
          </p>
          <p className="mt-1 text-[11px] text-amber-200/70">
            These predate device binding. Revoke them from the sessions page to
            force a clean, device-bound sign-in.
          </p>
        </div>
      ) : null}
    </div>
  );
}
