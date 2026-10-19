import { NextResponse } from "next/server";
import { and, asc, eq, gt } from "drizzle-orm";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invitation, member, user } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";
import { ORGANIZATION_ROLES, canAssignRole, getRole } from "@/lib/rbac/permissions";
import { organizationRoles } from "@/lib/rbac/access-control";

type OrgRoleKey = keyof typeof organizationRoles;

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(ORGANIZATION_ROLES as [string, ...string[]]),
});

const roleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(ORGANIZATION_ROLES as [string, ...string[]]),
});

const removeSchema = z
  .object({
    memberId: z.string().min(1).optional(),
    invitationId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.memberId) !== Boolean(value.invitationId), {
    message: "Provide exactly one of memberId or invitationId.",
  });

export async function GET(request: Request) {
  const gate = await guard("member:read");
  if (!gate.ok) return gate.response;

  if (!gate.ctx.activeOrganizationId) {
    return NextResponse.json(
      { error: "Select an organization first." },
      { status: 400 },
    );
  }

  const rows = await db
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
    .where(eq(member.organizationId, gate.ctx.activeOrganizationId))
    .orderBy(asc(member.createdAt));

  const { searchParams } = new URL(request.url);
  const includeInvitations = searchParams.get("invitations") === "true";

  const invitations = includeInvitations
    ? await db
        .select({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        })
        .from(invitation)
        .where(
          and(
            eq(invitation.organizationId, gate.ctx.activeOrganizationId),
            eq(invitation.status, "pending"),
            gt(invitation.expiresAt, new Date()),
          ),
        )
        .orderBy(asc(invitation.createdAt))
    : [];

  return NextResponse.json({
    members: rows.map((row) => ({ ...row, isSelf: row.userId === gate.ctx.user.id })),
    invitations,
  });
}

export async function POST(request: Request) {
  const gate = await guard("member:invite");
  if (!gate.ok) return gate.response;

  if (!gate.ctx.activeOrganizationId) {
    return NextResponse.json(
      { error: "Select an organization first." },
      { status: 400 },
    );
  }

  const body = await readJson(request, inviteSchema);
  if (!body.ok) return body.response;

  if (!canAssignRole(gate.ctx.roles, body.data.role)) {
    return NextResponse.json(
      { error: "You cannot invite a member at or above your own rank." },
      { status: 403 },
    );
  }

  try {
    const invitation = await auth.api.createInvitation({
      body: {
        email: body.data.email,
        role: body.data.role as OrgRoleKey,
        organizationId: gate.ctx.activeOrganizationId,
      },
      headers: request.headers,
    });

    await recordAudit({
      action: "organization.member_invited",
      category: "organization",
      severity: "medium",
      actorId: gate.ctx.user.id,
      actorEmail: gate.ctx.user.email,
      actorRole: gate.ctx.user.role ?? null,
      organizationId: gate.ctx.activeOrganizationId,
      resourceType: "invitation",
      resourceId:
        invitation && typeof invitation === "object" && "id" in invitation
          ? String(invitation.id)
          : null,
      description: `Invited ${body.data.email} as ${body.data.role}.`,
      metadata: { email: body.data.email, role: body.data.role },
      ipAddress: clientIpFromHeaders(request.headers),
    });

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not invite member.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const gate = await guard("member:update-role");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, roleSchema);
  if (!body.ok) return body.response;

  if (!canAssignRole(gate.ctx.roles, body.data.role)) {
    return NextResponse.json(
      { error: "You cannot assign a role at or above your own rank." },
      { status: 403 },
    );
  }

  const [target] = await db
    .select({ role: member.role, userId: member.userId })
    .from(member)
    .where(
      and(
        eq(member.id, body.data.memberId),
        eq(member.organizationId, gate.ctx.activeOrganizationId ?? ""),
      ),
    )
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (target.userId === gate.ctx.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own organization role." },
      { status: 400 },
    );
  }

  const actorRank = Math.max(
    ...gate.ctx.roles.map((role) => getRole(role).rank),
    0,
  );
  if (getRole(target.role).rank >= actorRank) {
    return NextResponse.json(
      { error: "You cannot modify a member at or above your own rank." },
      { status: 403 },
    );
  }

  try {
    await auth.api.updateMemberRole({
      body: {
        memberId: body.data.memberId,
        role: body.data.role as OrgRoleKey,
        organizationId: gate.ctx.activeOrganizationId ?? undefined,
      },
      headers: request.headers,
    });

    await recordAudit({
      action: "organization.member_role_changed",
      category: "role",
      severity: "high",
      actorId: gate.ctx.user.id,
      actorEmail: gate.ctx.user.email,
      actorRole: gate.ctx.user.role ?? null,
      organizationId: gate.ctx.activeOrganizationId,
      resourceType: "member",
      resourceId: body.data.memberId,
      description: `Changed member role to ${body.data.role}.`,
      metadata: { role: body.data.role },
      ipAddress: clientIpFromHeaders(request.headers),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update the member.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const gate = await guard("member:read");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, removeSchema);
  if (!body.ok) return body.response;

  const ip = clientIpFromHeaders(request.headers);

  if (body.data.invitationId) {
    if (!gate.ctx.permissions.has("member:invite")) {
      return NextResponse.json(
        { error: "Your role cannot cancel invitations." },
        { status: 403 },
      );
    }

    try {
      await auth.api.cancelInvitation({
        body: { invitationId: body.data.invitationId },
        headers: request.headers,
      });

      await recordAudit({
        action: "organization.invitation_cancelled",
        category: "organization",
        severity: "medium",
        actorId: gate.ctx.user.id,
        actorEmail: gate.ctx.user.email,
        actorRole: gate.ctx.user.role ?? null,
        organizationId: gate.ctx.activeOrganizationId,
        resourceType: "invitation",
        resourceId: body.data.invitationId,
        description: "Cancelled a pending invitation.",
        ipAddress: ip,
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not cancel the invitation.",
        },
        { status: 400 },
      );
    }
  }

  if (!gate.ctx.permissions.has("member:remove")) {
    return NextResponse.json(
      { error: "Your role cannot remove members." },
      { status: 403 },
    );
  }

  const [target] = await db
    .select({ userId: member.userId, role: member.role })
    .from(member)
    .where(
      and(
        eq(member.id, body.data.memberId ?? ""),
        eq(member.organizationId, gate.ctx.activeOrganizationId ?? ""),
      ),
    )
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (target.userId === gate.ctx.user.id) {
    return NextResponse.json(
      { error: "Use the leave action to remove yourself." },
      { status: 400 },
    );
  }

  const actorRank = Math.max(
    ...gate.ctx.roles.map((role) => getRole(role).rank),
    0,
  );
  if (getRole(target.role).rank >= actorRank) {
    return NextResponse.json(
      { error: "You cannot remove a member at or above your own rank." },
      { status: 403 },
    );
  }

  try {
    await auth.api.removeMember({
      body: {
        memberIdOrEmail: body.data.memberId ?? "",
        organizationId: gate.ctx.activeOrganizationId ?? undefined,
      },
      headers: request.headers,
    });

    await recordAudit({
      action: "organization.member_removed",
      category: "organization",
      severity: "high",
      actorId: gate.ctx.user.id,
      actorEmail: gate.ctx.user.email,
      actorRole: gate.ctx.user.role ?? null,
      organizationId: gate.ctx.activeOrganizationId,
      resourceType: "member",
      resourceId: body.data.memberId ?? null,
      description: "Removed a member from the organization.",
      metadata: { removedUserId: target.userId, role: target.role },
      ipAddress: ip,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not remove the member.",
      },
      { status: 400 },
    );
  }
}
