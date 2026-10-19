import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { db } from "@/lib/db";
import { session, user } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";
import {
  PLATFORM_ROLES,
  canAssignRole,
  getRole,
} from "@/lib/rbac/permissions";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set-role"),
    userId: z.string().min(1),
    role: z.enum(PLATFORM_ROLES as [string, ...string[]]),
  }),
  z.object({
    action: z.literal("ban"),
    userId: z.string().min(1),
    reason: z.string().trim().min(3).max(200),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  }),
  z.object({
    action: z.literal("unban"),
    userId: z.string().min(1),
  }),
]);

export async function GET(request: Request) {
  const gate = await guard("user:read");
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    Math.max(1, Number(searchParams.get("pageSize") ?? 25) || 25),
    100,
  );
  const search = searchParams.get("q")?.trim();
  const role = searchParams.get("role");

  const filters: SQL[] = [];
  if (search) {
    const pattern = `%${search}%`;
    const clause = or(
      ilike(user.email, pattern),
      ilike(user.name, pattern),
    );
    if (clause) filters.push(clause);
  }
  if (role) filters.push(eq(user.role, role));

  const where = filters.length ? and(...filters) : undefined;

  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        lastLoginMethod: user.lastLoginMethod,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(user).where(where),
  ]);

  return NextResponse.json({
    users: rows.map((row) => ({
      ...row,
      roleName: getRole(row.role).name,
      roleRank: getRole(row.role).rank,
    })),
    pagination: {
      page,
      pageSize,
      total: count?.total ?? 0,
      pages: Math.max(1, Math.ceil((count?.total ?? 0) / pageSize)),
    },
  });
}

export async function PATCH(request: Request) {
  const body = await readJson(request, patchSchema);
  if (!body.ok) return body.response;

  const permission =
    body.data.action === "set-role"
      ? "user:set-role"
      : "user:ban";

  const gate = await guard(permission);
  if (!gate.ok) return gate.response;

  const { ctx } = gate;

  if (body.data.userId === ctx.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own role or ban your own account." },
      { status: 400 },
    );
  }

  const [target] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      banned: user.banned,
    })
    .from(user)
    .where(eq(user.id, body.data.userId))
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const actorRank = Math.max(...ctx.roles.map((role) => getRole(role).rank), 0);
  const targetRank = getRole(target.role).rank;

  if (targetRank >= actorRank && !ctx.roles.includes("super_admin")) {
    return NextResponse.json(
      { error: "You cannot modify an account at or above your own rank." },
      { status: 403 },
    );
  }

  const ip = clientIpFromHeaders(request.headers);

  if (body.data.action === "set-role") {
    if (!canAssignRole(ctx.roles, body.data.role)) {
      return NextResponse.json(
        { error: "You cannot assign that role." },
        { status: 403 },
      );
    }

    await db
      .update(user)
      .set({ role: body.data.role, updatedAt: new Date() })
      .where(eq(user.id, target.id));

    await recordAudit({
      action: "user.role_changed",
      category: "role",
      severity: "high",
      actorId: ctx.user.id,
      actorEmail: ctx.user.email,
      actorRole: ctx.user.role ?? null,
      resourceType: "user",
      resourceId: target.id,
      description: `Changed ${target.email} from ${target.role} to ${body.data.role}.`,
      metadata: { previous: target.role, next: body.data.role },
      ipAddress: ip,
    });

    return NextResponse.json({ ok: true });
  }

  if (body.data.action === "ban") {
    const expires = body.data.expiresInDays
      ? new Date(Date.now() + body.data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await db
      .update(user)
      .set({
        banned: true,
        banReason: body.data.reason,
        banExpires: expires,
        updatedAt: new Date(),
      })
      .where(eq(user.id, target.id));

    const revoked = await db
      .delete(session)
      .where(eq(session.userId, target.id))
      .returning({ id: session.id });

    await recordAudit({
      action: "user.banned",
      category: "user",
      severity: "high",
      actorId: ctx.user.id,
      actorEmail: ctx.user.email,
      actorRole: ctx.user.role ?? null,
      resourceType: "user",
      resourceId: target.id,
      description: `Banned ${target.email}: ${body.data.reason}`,
      metadata: {
        reason: body.data.reason,
        expiresAt: expires,
        sessionsRevoked: revoked.length,
      },
      ipAddress: ip,
    });

    return NextResponse.json({ ok: true, sessionsRevoked: revoked.length });
  }

  await db
    .update(user)
    .set({ banned: false, banReason: null, banExpires: null, updatedAt: new Date() })
    .where(eq(user.id, target.id));

  await recordAudit({
    action: "user.unbanned",
    category: "user",
    severity: "high",
    actorId: ctx.user.id,
    actorEmail: ctx.user.email,
    actorRole: ctx.user.role ?? null,
    resourceType: "user",
    resourceId: target.id,
    description: `Lifted the ban on ${target.email}.`,
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true });
}
