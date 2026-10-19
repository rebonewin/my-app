import { eq } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileForm, type ProfileUser } from "@/components/settings/ProfileForm";
import { requirePermission } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { isEmailConfigured } from "@/lib/email";
import { getRole } from "@/lib/rbac/permissions";

export const instant = false;

export const metadata = {
  title: "Settings · 1Security",
};

export default async function SettingsPage() {
  const context = await requirePermission("settings:read", { next: "/settings" });

  const [row] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, context.user.id))
    .limit(1);

  const profile: ProfileUser = {
    id: context.user.id,
    name: row?.name ?? context.user.name ?? "",
    email: context.user.email,
    image: row?.image ?? null,
    emailVerified: Boolean(row?.emailVerified ?? context.user.emailVerified),
    roleLabel: getRole(context.user.role).name,
    createdAt: (row?.createdAt ?? new Date()).toISOString(),
    lastLoginAt: row?.lastLoginAt?.toISOString() ?? null,
    lastLoginMethod: row?.lastLoginMethod ?? null,
    twoFactorEnabled: Boolean(row?.twoFactorEnabled),
  };

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your identity as it appears across the platform, plus the security controls that protect it."
      />
      <ProfileForm user={profile} emailConfigured={isEmailConfigured()} />
    </div>
  );
}
