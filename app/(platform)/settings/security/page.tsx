import { and, eq, isNull } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import {
  SecuritySettings,
  type PasskeyRow,
} from "@/components/settings/SecuritySettings";
import { requirePermission } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { device, passkey, twoFactor, user } from "@/lib/db/schema";
import { isEmailConfigured, isSmsConfigured } from "@/lib/email";

export const instant = false;

export const metadata = {
  title: "Security settings · 1Security",
};

function countBackupCodes(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((code) => code && !String(code).startsWith("used:")).length;
    }
  } catch {
    // Codes are sometimes stored newline-separated.
    return raw.split(/\r?\n/).filter(Boolean).length;
  }
  return 0;
}

export default async function SecuritySettingsPage() {
  const context = await requirePermission("settings:read", {
    next: "/settings/security",
  });

  const [twoFactorRow] = await db
    .select({ backupCodes: twoFactor.backupCodes })
    .from(twoFactor)
    .where(eq(twoFactor.userId, context.user.id))
    .limit(1);

  const [account] = await db
    .select({ twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.id, context.user.id))
    .limit(1);

  const passkeyRows = await db
    .select({
      id: passkey.id,
      name: passkey.name,
      deviceType: passkey.deviceType,
      backedUp: passkey.backedUp,
      createdAt: passkey.createdAt,
    })
    .from(passkey)
    .where(eq(passkey.userId, context.user.id))
    .orderBy(passkey.createdAt);

  const trustedRows = await db
    .select({ id: device.id })
    .from(device)
    .where(
      and(
        eq(device.userId, context.user.id),
        eq(device.trusted, true),
        isNull(device.revokedAt),
      ),
    );

  const rows: PasskeyRow[] = passkeyRows.map((row) => ({
    id: row.id,
    name: row.name,
    deviceType: row.deviceType,
    backedUp: row.backedUp,
    createdAt: row.createdAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Security settings"
        description="Credentials, second factors and recovery material. Changes here take effect immediately for every new sign-in."
      />
      <SecuritySettings
        twoFactorEnabled={Boolean(account?.twoFactorEnabled)}
        backupCodesRemaining={countBackupCodes(twoFactorRow?.backupCodes)}
        passkeys={rows}
        trustedDevices={trustedRows.length}
        emailConfigured={isEmailConfigured()}
        smsConfigured={isSmsConfigured()}
      />
    </div>
  );
}
