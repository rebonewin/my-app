import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  device,
  loginHistory,
  passkey,
  scan,
  securityEvent,
  session,
  user,
} from "@/lib/db/schema";
import { computeSecurityScore } from "./threat-detection";

export interface SecurityOverview {
  score: ReturnType<typeof computeSecurityScore>;
  counts: {
    activeSessions: number;
    passkeys: number;
    trustedDevices: number;
    openEvents: number;
    eventsLast30Days: number;
    scans: number;
    highRiskScans: number;
    failedLogins: number;
    countries: number;
  };
  recentEvents: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string | null;
    status: string;
    createdAt: Date;
    ipAddress: string | null;
    country: string | null;
  }>;
  recentLogins: Array<{
    id: string;
    status: string;
    method: string;
    ipAddress: string | null;
    city: string | null;
    country: string | null;
    browser: string | null;
    os: string | null;
    createdAt: Date;
  }>;
  recentScans: Array<{
    id: string;
    target: string;
    riskLevel: string | null;
    riskScore: number;
    findingCount: number;
    status: string;
    createdAt: Date;
  }>;
}

/** Aggregates everything the security dashboard renders, in one round trip set. */
export async function getSecurityOverview(
  userId: string,
): Promise<SecurityOverview> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    [account],
    [sessionCount],
    [passkeyCount],
    [deviceCount],
    [openEventCount],
    [eventCount30],
    [scanStats],
    [failedLoginCount],
    [countryCount],
    recentEvents,
    recentLogins,
    recentScans,
  ] = await Promise.all([
    db
      .select({
        twoFactorEnabled: user.twoFactorEnabled,
        emailVerified: user.emailVerified,
        passwordChangedAt: user.passwordChangedAt,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(session)
      .where(
        and(eq(session.userId, userId), gte(session.expiresAt, new Date())),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(passkey)
      .where(eq(passkey.userId, userId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(device)
      .where(and(eq(device.userId, userId), eq(device.trusted, true))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(securityEvent)
      .where(
        and(
          eq(securityEvent.userId, userId),
          eq(securityEvent.status, "open"),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(securityEvent)
      .where(
        and(
          eq(securityEvent.userId, userId),
          gte(securityEvent.createdAt, thirtyDaysAgo),
        ),
      ),
    db
      .select({
        total: sql<number>`count(*)::int`,
        highRisk: sql<number>`count(*) filter (where ${scan.riskLevel} in ('high','critical'))::int`,
      })
      .from(scan)
      .where(eq(scan.userId, userId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(loginHistory)
      .where(
        and(
          eq(loginHistory.userId, userId),
          eq(loginHistory.status, "failed"),
          gte(loginHistory.createdAt, thirtyDaysAgo),
        ),
      ),
    db
      .select({
        n: sql<number>`count(distinct ${loginHistory.country})::int`,
      })
      .from(loginHistory)
      .where(
        and(
          eq(loginHistory.userId, userId),
          eq(loginHistory.status, "success"),
        ),
      ),
    db
      .select({
        id: securityEvent.id,
        type: securityEvent.type,
        severity: securityEvent.severity,
        title: securityEvent.title,
        description: securityEvent.description,
        status: securityEvent.status,
        createdAt: securityEvent.createdAt,
        ipAddress: securityEvent.ipAddress,
        country: securityEvent.country,
      })
      .from(securityEvent)
      .where(eq(securityEvent.userId, userId))
      .orderBy(desc(securityEvent.createdAt))
      .limit(6),
    db
      .select({
        id: loginHistory.id,
        status: loginHistory.status,
        method: loginHistory.method,
        ipAddress: loginHistory.ipAddress,
        city: loginHistory.city,
        country: loginHistory.country,
        browser: loginHistory.browser,
        os: loginHistory.os,
        createdAt: loginHistory.createdAt,
      })
      .from(loginHistory)
      .where(eq(loginHistory.userId, userId))
      .orderBy(desc(loginHistory.createdAt))
      .limit(8),
    db
      .select({
        id: scan.id,
        target: scan.target,
        riskLevel: scan.riskLevel,
        riskScore: scan.riskScore,
        findingCount: scan.findingCount,
        status: scan.status,
        createdAt: scan.createdAt,
      })
      .from(scan)
      .where(eq(scan.userId, userId))
      .orderBy(desc(scan.createdAt))
      .limit(5),
  ]);

  const passwordAgeDays = account?.passwordChangedAt
    ? Math.floor(
        (Date.now() - account.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24),
      )
    : null;

  const accountAgeDays = account?.createdAt
    ? Math.floor(
        (Date.now() - account.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      )
    : 0;

  const score = computeSecurityScore({
    mfaEnabled: Boolean(account?.twoFactorEnabled),
    passkeyCount: passkeyCount?.n ?? 0,
    emailVerified: Boolean(account?.emailVerified),
    passwordAgeDays,
    activeSessions: sessionCount?.n ?? 0,
    trustedDevices: deviceCount?.n ?? 0,
    recentThreats: eventCount30?.n ?? 0,
    accountAgeDays,
  });

  return {
    score,
    counts: {
      activeSessions: sessionCount?.n ?? 0,
      passkeys: passkeyCount?.n ?? 0,
      trustedDevices: deviceCount?.n ?? 0,
      openEvents: openEventCount?.n ?? 0,
      eventsLast30Days: eventCount30?.n ?? 0,
      scans: scanStats?.total ?? 0,
      highRiskScans: scanStats?.highRisk ?? 0,
      failedLogins: failedLoginCount?.n ?? 0,
      countries: countryCount?.n ?? 0,
    },
    recentEvents,
    recentLogins,
    recentScans,
  };
}
