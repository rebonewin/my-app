import { NextResponse } from "next/server";
import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import { z } from "zod";

import { guard } from "@/lib/api/guard";
import { db } from "@/lib/db";
import {
  auditLog,
  device,
  loginHistory,
  passkey,
  session,
  trustedDevice,
  user,
} from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";
import { getRole } from "@/lib/rbac/permissions";

/**
 * Per-user administrative view.
 *
 * Three scopes share one route so the UI can drive a single detail screen:
 *  - `profile`  identity, posture and resource counts      (user:read)
 *  - `sessions` live sessions bound to the account        (session:read)
 *  - `audit`    everything this account did               (audit:read)
 *
 * DELETE force-logs the account out (`user:force-logout`). The scope
 * permissions are all platform-only in the RBAC matrix, so an organization role
 * can never widen into them.
 */

const SCOPES = {
  profile: "user:read",
  sessions: "session:read",
  audit: "audit:read",
} as const;

type Scope = keyof typeof SCOPES;

const scopeSchema = z.enum(["profile", "sessions", "audit"]);

/** Load the target account and enforce the rank ceiling. */
async function loadTarget(
  ctx: { roles: string[] },
  targetId: string,
): Promise<{ target: typeof user.$inferSelect } | { response: NextResponse }> {
  const [target] = await db
    .select()
    .from(user)
    .where(eq(user.id, targetId))
    .limit(1);

  if (!target) {
    return {
      response: NextResponse.json({ error: "User not found." }, { status: 404 }),
    };
  }

  const actorRank = Math.max(...ctx.roles.map((role) => getRole(role).rank), 0);
  if (
    getRole(target.role).rank >= actorRank &&
    !ctx.roles.includes("super_admin")
  ) {
    return {
      response: NextResponse.json(
        {
          error:
            "You cannot inspect an account at or above your own rank.",
        },
        { status: 403 },
      ),
    };
  }

  return { target };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const parsed = scopeSchema.safeParse(
    new URL(request.url).searchParams.get("scope") ?? "profile",
  );
  const scope: Scope = parsed.success ? parsed.data : "profile";

  const gate = await guard(SCOPES[scope]);
  if (!gate.ok) return gate.response;

  const loaded = await loadTarget(gate.ctx, id);
  if ("response" in loaded) return loaded.response;
  const { target } = loaded;

  if (scope === "profile") {
    const [[activeSessions], [knownDevices], [registeredPasskeys], [loginRows]] =
      await Promise.all([
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(session)
          .where(
            and(
              eq(session.userId, target.id),
              gt(session.expiresAt, new Date()),
            ),
          ),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(device)
          .where(
            and(eq(device.userId, target.id), sql`${device.revokedAt} is null`),
          ),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(passkey)
          .where(eq(passkey.userId, target.id)),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(loginHistory)
          .where(eq(loginHistory.userId, target.id)),
      ]);

    return NextResponse.json({
      user: {
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
        roleName: getRole(target.role).name,
        roleRank: getRole(target.role).rank,
        emailVerified: target.emailVerified,
        twoFactorEnabled: target.twoFactorEnabled,
        banned: target.banned,
        banReason: target.banReason,
        banExpires: target.banExpires,
        mustChangePassword: target.mustChangePassword,
        passwordChangedAt: target.passwordChangedAt,
        createdAt: target.createdAt,
        lastLoginAt: target.lastLoginAt,
        lastLoginMethod: target.lastLoginMethod,
      },
      counts: {
        sessions: activeSessions?.total ?? 0,
        devices: knownDevices?.total ?? 0,
        passkeys: registeredPasskeys?.total ?? 0,
        loginHistory: loginRows?.total ?? 0,
      },
      // The UI only shows the actions this caller may actually perform.
      canForceLogout: gate.ctx.permissions.has("user:force-logout"),
      canViewSessions: gate.ctx.permissions.has("session:read"),
      canViewAudit: gate.ctx.permissions.has("audit:read"),
    });
  }

  if (scope === "sessions") {
    const rows = await db
      .select({
        id: session.id,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
        expiresAt: session.expiresAt,
        deviceId: session.deviceId,
        revokedAt: session.revokedAt,
      })
      .from(session)
      .where(
        and(
          eq(session.userId, target.id),
          gt(session.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(session.lastActiveAt))
      .limit(50);

    return NextResponse.json({ sessions: rows });
  }

  const rows = await db
    .select()
    .from(auditLog)
    .where(
      or(eq(auditLog.actorId, target.id), eq(auditLog.resourceId, target.id)),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(100);

  return NextResponse.json({ audit: rows });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const gate = await guard("user:force-logout");
  if (!gate.ok) return gate.response;

  if (id === gate.ctx.user.id) {
    return NextResponse.json(
      {
        error:
          "You cannot force-logout your own account here. Use the sign-out control instead.",
      },
      { status: 400 },
    );
  }

  const loaded = await loadTarget(gate.ctx, id);
  if ("response" in loaded) return loaded.response;
  const { target } = loaded;

  // Sessions and remembered-device tokens are separate credentials; both must
  // go, otherwise the account signs straight back in on a trusted device.
  const [revokedSessions] = await Promise.all([
    db
      .delete(session)
      .where(eq(session.userId, target.id))
      .returning({ id: session.id }),
    db.delete(trustedDevice).where(eq(trustedDevice.userId, target.id)),
  ]);

  await recordAudit({
    action: "user.force_logout",
    category: "user",
    severity: "high",
    actorId: gate.ctx.user.id,
    actorEmail: gate.ctx.user.email,
    actorRole: gate.ctx.user.role ?? null,
    resourceType: "user",
    resourceId: target.id,
    description: `Force-logged out ${target.email}.`,
    metadata: { sessionsRevoked: revokedSessions.length },
    ipAddress: clientIpFromHeaders(request.headers),
  });

  return NextResponse.json({
    ok: true,
    sessionsRevoked: revokedSessions.length,
  });
}
