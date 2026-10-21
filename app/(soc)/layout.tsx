import type { Metadata } from "next";

import { SocShell } from "@/components/layout/SocShell";
import { SocThemeScript } from "@/components/layout/SocThemeScript";
import { getActiveOrganization, requireAuth } from "@/lib/auth/server";
import { getRole } from "@/lib/rbac/permissions";
import { titleCase } from "@/lib/utils";

/**
 * The SOC shell depends on cookie-bound session data and must render per
 * request. Authentication is enforced here, and again with a permission check
 * on the dashboard page itself.
 */
export const instant = false;

export const metadata: Metadata = {
  title: {
    default: "1Security SOC",
    template: "%s · 1Security SOC",
  },
  description:
    "Security operations centre for posture, exposure and threat intelligence.",
};

export default async function SocLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireAuth();
  const activeOrganization = await getActiveOrganization();
  const role = getRole(context.user.role);

  return (
    <>
      <SocThemeScript />
      <div className="soc-theme soc-canvas min-h-dvh text-soc-fg">
        <SocShell
          user={{
            name: context.user.name,
            email: context.user.email,
            roleLabel: role.name,
            organizationName: activeOrganization?.name ?? null,
            organizationRole: activeOrganization
              ? titleCase(activeOrganization.role)
              : null,
          }}
        >
          {children}
        </SocShell>
      </div>
    </>
  );
}
