import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { guard } from "@/lib/api/guard";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

const CATEGORIES = new Set([
  "general",
  "auth",
  "session",
  "security",
  "role",
  "user",
  "scanner",
  "api_key",
  "organization",
  "admin",
]);

export async function GET(request: Request) {
  const gate = await guard("audit:read");
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    Math.max(1, Number(searchParams.get("pageSize") ?? 25) || 25),
    100,
  );
  const category = searchParams.get("category");
  const severity = searchParams.get("severity");
  const search = searchParams.get("q")?.trim();

  // Platform administrators see the whole tenant; everyone else sees only the
  // events they caused. This prevents a customer from reading another
  // customer's authentication history.
  const isPlatformAdmin = gate.ctx.permissions.has("dashboard:admin");

  const filters: SQL[] = [];
  if (!isPlatformAdmin) {
    filters.push(eq(auditLog.actorId, gate.ctx.user.id));
  }
  if (category && CATEGORIES.has(category)) {
    filters.push(eq(auditLog.category, category));
  }
  if (severity && ["info", "low", "medium", "high", "critical"].includes(severity)) {
    filters.push(eq(auditLog.severity, severity));
  }
  if (search) {
    const pattern = `%${search}%`;
    const searchClause = or(
      ilike(auditLog.action, pattern),
      ilike(auditLog.description, pattern),
      ilike(auditLog.actorEmail, pattern),
    );
    if (searchClause) filters.push(searchClause);
  }

  const where = filters.length ? and(...filters) : undefined;

  const [rows, [count]] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where),
  ]);

  return NextResponse.json({
    logs: rows,
    pagination: {
      page,
      pageSize,
      total: count?.total ?? 0,
      pages: Math.max(1, Math.ceil((count?.total ?? 0) / pageSize)),
    },
  });
}
