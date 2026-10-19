import { and, desc, eq, gte } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import { SessionsManager, type SessionRow } from "@/components/security/SessionsManager";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { loginHistory, session } from "@/lib/db/schema";
import { parseUserAgent } from "@/lib/security/user-agent";

export const instant = false;

export const metadata = {
  title: "Sessions · 1Security",
};

export default async function SessionsPage() {
  const context = await requirePermission("session:read", { next: "/sessions" });

  const rows = await db
    .select()
    .from(session)
    .where(
      and(
        eq(session.userId, context.user.id),
        gte(session.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(session.lastActiveAt));

  const geoBySession = new Map(
    (
      await db
        .select({
          sessionId: loginHistory.sessionId,
          city: loginHistory.city,
          country: loginHistory.country,
        })
        .from(loginHistory)
        .where(eq(loginHistory.userId, context.user.id))
        .orderBy(desc(loginHistory.createdAt))
        .limit(200)
    )
      .filter((row) => row.sessionId)
      .map((row) => [row.sessionId as string, row]),
  );

  const sessions: SessionRow[] = rows.map((row) => {
    const parsed = parseUserAgent(row.userAgent);
    const geo = geoBySession.get(row.id);
    return {
      id: row.id,
      ipAddress: row.ipAddress ?? null,
      userAgent: row.userAgent ?? null,
      createdAt: row.createdAt.toISOString(),
      lastActiveAt: row.lastActiveAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      deviceId: row.deviceId ?? null,
      impersonatedBy: row.impersonatedBy ?? null,
      browser: parsed.browser,
      os: parsed.os,
      deviceType: parsed.deviceType,
      city: geo?.city ?? null,
      country: geo?.country ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        eyebrow="Identity"
        title="Active sessions"
        description="Every live session is a credential. Review the device, location and last activity, then revoke anything you do not recognise."
      />

      {sessions.length === 0 ? (
        <Alert tone="warning" title="No active sessions">
          This should be impossible while you are signed in. Reload; if it
          persists, sign out and back in.
        </Alert>
      ) : (
        <Card>
          <CardBody>
            <SessionsManager
              sessions={sessions}
              currentSessionId={context.session.session.id}
              canRevoke={context.permissions.has("session:revoke")}
              canRevokeAll={context.permissions.has("session:revoke-all")}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
