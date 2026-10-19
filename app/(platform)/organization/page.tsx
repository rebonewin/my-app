import { eq, inArray, sql } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import { OrganizationSettings, type OrganizationRow } from "@/components/organization/OrganizationSettings";
import { requirePermission } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";
import { getRole } from "@/lib/rbac/permissions";

export const instant = false;

export const metadata = {
  title: "Organization · 1Security",
};

export default async function OrganizationPage() {
  const context = await requirePermission("organization:read", {
    next: "/organization",
  });

  const memberships = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
      seats: organization.seats,
      createdAt: organization.createdAt,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, context.user.id));

  const orgIds = memberships.map((row) => row.id);

  const counts = orgIds.length
    ? await db
        .select({
          organizationId: member.organizationId,
          total: sql<number>`count(*)::int`,
        })
        .from(member)
        .where(inArray(member.organizationId, orgIds))
        .groupBy(member.organizationId)
    : [];

  const countByOrg = new Map(counts.map((row) => [row.organizationId, row.total]));

  const organizations: OrganizationRow[] = memberships.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    role: row.role ?? "customer",
    roleName: getRole(row.role).name,
    plan: row.plan,
    seats: row.seats,
    memberCount: countByOrg.get(row.id) ?? 1,
    createdAt: row.createdAt.toISOString(),
    isActive: row.id === context.activeOrganizationId,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Tenancy"
        title="Organizations"
        description="Tenants isolate members, roles, scans and reports. Your active organization scopes every query and permission check."
      />
      <OrganizationSettings
        organizations={organizations}
        canCreate={context.permissions.has("organization:create")}
        canUpdate={context.permissions.has("organization:update")}
      />
    </div>
  );
}
