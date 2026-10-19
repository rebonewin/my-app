import type { Metadata } from "next";
import { and, eq, sql } from "drizzle-orm";

import { AppShell, type NavSection } from "@/components/layout/AppShell";
import {
  getActiveOrganization,
  getOrganizations,
  hasEffectivePermission,
  requireAuth,
} from "@/lib/auth/server";
import { db } from "@/lib/db";
import { securityEvent } from "@/lib/db/schema";
import { getRole } from "@/lib/rbac/permissions";
import {
  ActivityIcon,
  AlertIcon,
  BuildingIcon,
  FileIcon,
  GaugeIcon,
  KeyIcon,
  MonitorIcon,
  RadarIcon,
  SettingsIcon,
  ShieldIcon,
  SmartphoneIcon,
  UserCogIcon,
  UsersIcon,
} from "@/components/ui/icons";

/**
 * Every page under this layout depends on cookie-bound session data, so the
 * segment opts out of instant-navigation validation and renders per request.
 * The proxy only checks that a cookie exists; the real boundary is
 * `requireAuth` below.
 */
export const instant = false;

export const metadata: Metadata = {
  title: "1Security Platform",
  description: "Enterprise security operations platform.",
};

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireAuth();
  const organizations = await getOrganizations();
  const activeOrganization = await getActiveOrganization();

  // Open security events for this account power the sidebar badge.
  const [openEvents] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(securityEvent)
    .where(
      and(
        eq(securityEvent.userId, context.user.id),
        eq(securityEvent.status, "open"),
      ),
    )
    .catch(() => [{ count: 0 }]);

  const can = (permission: string) =>
    hasEffectivePermission(context, permission);

  const sections: NavSection[] = [
    {
      title: "Operations",
      items: [
        {
          href: "/dashboard",
          label: "Dashboard",
          icon: <GaugeIcon size={17} />,
        },
        {
          href: "/scanner",
          label: "Scanner",
          icon: <RadarIcon size={17} />,
        },
        {
          href: "/security",
          label: "Security",
          icon: <AlertIcon size={17} />,
          badge: openEvents?.count ? String(openEvents.count) : null,
        },
        {
          href: "/reports",
          label: "Reports",
          icon: <FileIcon size={17} />,
        },
      ].filter((item) => {
        if (item.href === "/dashboard") return can("dashboard:read");
        if (item.href === "/scanner") return can("scanner:read");
        if (item.href === "/security") return can("security:read");
        if (item.href === "/reports") return can("report:read");
        return true;
      }),
    },
    {
      title: "Identity",
      items: [
        {
          href: "/sessions",
          label: "Sessions",
          icon: <MonitorIcon size={17} />,
        },
        {
          href: "/devices",
          label: "Devices",
          icon: <SmartphoneIcon size={17} />,
        },
        {
          href: "/activity",
          label: "Login activity",
          icon: <ActivityIcon size={17} />,
        },
      ].filter((item) => {
        if (item.href === "/sessions") return can("session:read");
        if (item.href === "/devices") return can("device:read");
        if (item.href === "/activity") return can("audit:read");
        return true;
      }),
    },
    {
      title: "Governance",
      items: [
        {
          href: "/audit",
          label: "Audit log",
          icon: <ShieldIcon size={17} />,
        },
        {
          href: "/api-keys",
          label: "API keys",
          icon: <KeyIcon size={17} />,
        },
        {
          href: "/organization",
          label: "Organization",
          icon: <BuildingIcon size={17} />,
        },
        {
          href: "/organization/members",
          label: "Members",
          icon: <UsersIcon size={17} />,
        },
      ].filter((item) => {
        if (item.href === "/audit") return can("audit:read");
        if (item.href === "/api-keys") return can("api_key:read");
        if (item.href === "/organization") return can("organization:read");
        if (item.href === "/organization/members") return can("member:read");
        return true;
      }),
    },
    {
      title: "Platform",
      items: [
        {
          href: "/admin",
          label: "Administration",
          icon: <UserCogIcon size={17} />,
        },
        {
          href: "/settings",
          label: "Settings",
          icon: <SettingsIcon size={17} />,
        },
      ].filter((item) => {
        if (item.href === "/admin") return can("dashboard:admin");
        if (item.href === "/settings") return can("settings:read");
        return true;
      }),
    },
  ].filter((section) => section.items.length > 0);

  const role = getRole(context.user.role);

  return (
    <AppShell
      user={{
        id: context.user.id,
        name: context.user.name ?? "Unnamed operator",
        email: context.user.email,
        image: context.user.image ?? null,
        role: context.user.role ?? "guest",
        roleLabel: role.name,
        emailVerified: Boolean(context.user.emailVerified),
        twoFactorEnabled: Boolean(context.user.twoFactorEnabled),
      }}
      sections={sections}
      organizations={organizations}
      activeOrganizationId={activeOrganization?.id ?? null}
    >
      {children}
    </AppShell>
  );
}
