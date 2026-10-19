import Link from "next/link";
import { and, asc, eq, gt } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import {
  MembersManager,
  type InvitationRow,
  type MemberRow,
  type RoleOption,
} from "@/components/organization/MembersManager";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import { BuildingIcon, UsersIcon } from "@/components/ui/icons";
import { requirePermission } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { invitation, member, user } from "@/lib/db/schema";
import {
  ROLES,
  canAssignRole,
  getRole,
} from "@/lib/rbac/permissions";

export const instant = false;

export const metadata = {
  title: "Members · 1Security",
};

export default async function MembersPage() {
  const context = await requirePermission("member:read", {
    next: "/organization/members",
  });

  if (!context.activeOrganizationId) {
    return (
      <div>
        <PageHeader
          eyebrow="Tenancy"
          title="Members"
          description="Organization membership is scoped to the tenant you have selected."
        />
        <Card>
          <CardBody>
            <EmptyState
              icon={<BuildingIcon size={20} />}
              title="No active organization"
              description="Create or select an organization before managing its members."
              action={
                <ButtonLink href="/organization" size="sm">
                  Manage organizations
                </ButtonLink>
              }
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, context.user.id),
        eq(member.organizationId, context.activeOrganizationId),
      ),
    )
    .limit(1);

  const actorRoles = [context.user.role, membership?.role].filter(
    (value): value is string => Boolean(value),
  );
  const actorRank = Math.max(...actorRoles.map((role) => getRole(role).rank), 0);

  const memberRows = await db
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      name: user.name,
      email: user.email,
      image: user.image,
      twoFactorEnabled: user.twoFactorEnabled,
      lastLoginAt: user.lastLoginAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, context.activeOrganizationId))
    .orderBy(asc(member.createdAt));

  const members: MemberRow[] = memberRows.map((row) => {
    const targetRole = getRole(row.role);
    return {
      id: row.id,
      userId: row.userId,
      name: row.name ?? "",
      email: row.email,
      image: row.image,
      role: row.role ?? "customer",
      roleName: targetRole.name,
      twoFactorEnabled: Boolean(row.twoFactorEnabled),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      isSelf: row.userId === context.user.id,
      canManage:
        row.userId !== context.user.id &&
        targetRole.rank < actorRank &&
        canAssignRole(actorRoles, row.role ?? "customer"),
    };
  });

  const invitationRows = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, context.activeOrganizationId),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(invitation.createdAt));

  const invitations: InvitationRow[] = invitationRows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role ?? "customer",
    roleName: getRole(row.role).name,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));

  const roleOptions: RoleOption[] = Object.values(ROLES)
    .filter(
      (role) =>
        role.scope !== "platform" &&
        role.slug !== "guest" &&
        canAssignRole(actorRoles, role.slug),
    )
    .sort((a, b) => b.rank - a.rank)
    .map((role) => ({ slug: role.slug, name: role.name }));

  const canInvite = context.permissions.has("member:invite");
  const canUpdateRole = context.permissions.has("member:update-role");
  const canRemove = context.permissions.has("member:remove");

  return (
    <div>
      <PageHeader
        eyebrow="Tenancy"
        title="Members"
        description="Invite teammates, assign least-privilege roles and review the security posture of every account in this tenant."
        actions={
          <ButtonLink href="/organization" size="sm" variant="secondary">
            <UsersIcon size={14} />
            Organizations
          </ButtonLink>
        }
      />

      {!canInvite ? (
        <div className="mb-4">
          <Alert tone="info">
            You have read-only access to this membership list. Inviting,
            promoting and removing members requires the corresponding
            organization permission and a higher role than the target.
            {" "}
            <Link href="/forbidden" className="underline decoration-dotted">
              Why?
            </Link>
          </Alert>
        </div>
      ) : null}

      <MembersManager
        organizationName={
          memberRows.length > 0 ? "this organization" : "the organization"
        }
        members={members}
        invitations={invitations}
        roleOptions={roleOptions.length ? roleOptions : [{ slug: "customer", name: "Customer" }]}
        canInvite={canInvite}
        canUpdateRole={canUpdateRole}
        canRemove={canRemove}
      />
    </div>
  );
}
