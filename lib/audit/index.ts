import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, securityAlert } from "@/lib/db/schema";

export type AuditSeverity = "info" | "low" | "medium" | "high" | "critical";

export type AuditCategory =
  | "auth"
  | "session"
  | "user"
  | "organization"
  | "member"
  | "role"
  | "permission"
  | "security"
  | "scanner"
  | "report"
  | "api_key"
  | "settings"
  | "billing"
  | "ai"
  | "general";

export interface AuditInput {
  action: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  organizationId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  success?: boolean;
}

/**
 * Append-only audit trail.
 *
 * Audit writes must never break the user-facing request, so failures are
 * swallowed after being reported. `recordAuditStrict` exists for the rare
 * caller (compliance export, privilege change) that must fail closed.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      action: input.action,
      category: input.category ?? "general",
      severity: input.severity ?? "info",
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      actorRole: input.actorRole ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      organizationId: input.organizationId ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      requestId: input.requestId ?? null,
      success: input.success ?? true,
    });
  } catch (error) {
    console.error("[audit] failed to record", input.action, error);
  }
}

export async function recordAuditStrict(input: AuditInput): Promise<void> {
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    action: input.action,
    category: input.category ?? "general",
    severity: input.severity ?? "info",
    actorId: input.actorId ?? null,
    actorEmail: input.actorEmail ?? null,
    actorRole: input.actorRole ?? null,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    organizationId: input.organizationId ?? null,
    description: input.description ?? null,
    metadata: input.metadata ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    requestId: input.requestId ?? null,
    success: input.success ?? true,
  });
}

/** Bulk audit for batch operations. */
export async function recordAuditBatch(inputs: AuditInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    await db.insert(auditLog).values(
      inputs.map((input) => ({
        id: crypto.randomUUID(),
        action: input.action,
        category: input.category ?? "general",
        severity: input.severity ?? "info",
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRole: input.actorRole ?? null,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        organizationId: input.organizationId ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
        success: input.success ?? true,
      })),
    );
  } catch (error) {
    console.error("[audit] failed to record batch", error);
  }
}

export interface AuditQuery {
  actorId?: string;
  action?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  organizationId?: string;
  since?: Date;
  limit?: number;
  offset?: number;
}

export async function queryAuditLogs(query: AuditQuery = {}) {
  const limit = Math.min(query.limit ?? 50, 200);
  const conditions = [];

  if (query.actorId) conditions.push(eq(auditLog.actorId, query.actorId));
  if (query.action) conditions.push(eq(auditLog.action, query.action));
  if (query.category) conditions.push(eq(auditLog.category, query.category));
  if (query.severity) conditions.push(eq(auditLog.severity, query.severity));
  if (query.organizationId)
    conditions.push(eq(auditLog.organizationId, query.organizationId));
  if (query.since) conditions.push(gte(auditLog.createdAt, query.since));

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, count] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(query.offset ?? 0),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where),
  ]);

  return { rows, total: count[0]?.total ?? 0, limit };
}

/** Convenience wrapper for in-app security alerts. */
export async function createAlert(input: {
  userId?: string | null;
  organizationId?: string | null;
  eventId?: string | null;
  title: string;
  body?: string | null;
  severity?: AuditSeverity;
  channel?: "in_app" | "email" | "webhook";
}): Promise<void> {
  try {
    await db.insert(securityAlert).values({
      id: crypto.randomUUID(),
      userId: input.userId ?? null,
      organizationId: input.organizationId ?? null,
      eventId: input.eventId ?? null,
      title: input.title,
      body: input.body ?? null,
      severity: input.severity ?? "medium",
      channel: input.channel ?? "in_app",
    });
  } catch (error) {
    console.error("[alert] failed to create", error);
  }
}
