import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  loginAttempt,
  loginHistory,
  securityEvent,
  user,
} from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { getIpIntel, haversineKm, type IpInfo } from "./ip-intel";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type ThreatType =
  | "impossible_travel"
  | "new_country"
  | "vpn_login"
  | "tor_login"
  | "bot_login"
  | "credential_stuffing"
  | "brute_force"
  | "password_spray"
  | "multiple_device_abuse"
  | "multiple_ip_abuse"
  | "session_hijack"
  | "new_device";

export type ThreatAction = "logged" | "alerted" | "challenged" | "blocked";

export interface ThreatFinding {
  type: ThreatType;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  riskScore: number;
  action: ThreatAction;
  metadata?: Record<string, unknown>;
}

export interface LoginContext {
  userId?: string | null;
  email: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  method: string;
  deviceFingerprint?: string | null;
}

/* -------------------------------------------------------------------------- */
/*                              Thresholds                                    */
/* -------------------------------------------------------------------------- */

export const THRESHOLDS = {
  /** Failed attempts per account before lockout. */
  bruteForcePerAccount: 5,
  bruteForceWindowMinutes: 15,
  /** Failed attempts per IP. */
  bruteForcePerIp: 20,
  bruteForceIpWindowMinutes: 15,
  /** Distinct accounts from one IP = spraying. */
  sprayDistinctAccounts: 8,
  sprayWindowMinutes: 30,
  /** Distinct accounts from one device fingerprint = stuffing. */
  stuffingDistinctAccounts: 5,
  stuffingWindowMinutes: 30,
  /** Impossible travel: km/h above which travel is physically impossible. */
  impossibleTravelKmh: 900,
  /** Minimum distance to bother evaluating (avoids city-level jitter). */
  impossibleTravelMinKm: 500,
  /** Distinct IPs for one user within the window. */
  multipleIpThreshold: 5,
  multipleIpWindowMinutes: 60,
  /** Distinct devices for one user within the window. */
  multipleDeviceThreshold: 4,
  multipleDeviceWindowMinutes: 60,
} as const;

/* -------------------------------------------------------------------------- */
/*                            Detection primitives                            */
/* -------------------------------------------------------------------------- */

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function countFailedForAccount(
  email: string,
  windowMinutes: number,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loginAttempt)
    .where(
      and(
        eq(loginAttempt.identifier, email.toLowerCase()),
        eq(loginAttempt.success, false),
        gte(loginAttempt.createdAt, minutesAgo(windowMinutes)),
      ),
    );
  return row?.n ?? 0;
}

async function countFailedForIp(
  ip: string,
  windowMinutes: number,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loginAttempt)
    .where(
      and(
        eq(loginAttempt.ipAddress, ip),
        eq(loginAttempt.success, false),
        gte(loginAttempt.createdAt, minutesAgo(windowMinutes)),
      ),
    );
  return row?.n ?? 0;
}

async function distinctAccountsForIp(
  ip: string,
  windowMinutes: number,
): Promise<number> {
  const [row] = await db
    .select({
      n: sql<number>`count(distinct ${loginAttempt.identifier})::int`,
    })
    .from(loginAttempt)
    .where(
      and(
        eq(loginAttempt.ipAddress, ip),
        gte(loginAttempt.createdAt, minutesAgo(windowMinutes)),
      ),
    );
  return row?.n ?? 0;
}

async function distinctIpsForUser(
  userId: string,
  windowMinutes: number,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${loginHistory.ipAddress})::int` })
    .from(loginHistory)
    .where(
      and(
        eq(loginHistory.userId, userId),
        gte(loginHistory.createdAt, minutesAgo(windowMinutes)),
      ),
    );
  return row?.n ?? 0;
}

async function distinctDevicesForUser(
  userId: string,
  windowMinutes: number,
): Promise<number> {
  const [row] = await db
    .select({
      n: sql<number>`count(distinct ${loginHistory.userAgent})::int`,
    })
    .from(loginHistory)
    .where(
      and(
        eq(loginHistory.userId, userId),
        gte(loginHistory.createdAt, minutesAgo(windowMinutes)),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Impossible travel compares the new login against the most recent successful
 * login that has coordinates. Requires both points to be geolocated.
 */
export async function detectImpossibleTravel(
  userId: string,
  current: IpInfo,
): Promise<ThreatFinding | null> {
  if (!current.latitude || !current.longitude) return null;

  const [previous] = await db
    .select()
    .from(loginHistory)
    .where(
      and(
        eq(loginHistory.userId, userId),
        eq(loginHistory.status, "success"),
        sql`${loginHistory.latitude} is not null`,
        sql`${loginHistory.longitude} is not null`,
      ),
    )
    .orderBy(desc(loginHistory.createdAt))
    .limit(1);

  if (!previous?.latitude || !previous.longitude) return null;

  const distance = haversineKm(
    {
      lat: Number(previous.latitude),
      lon: Number(previous.longitude),
    },
    { lat: Number(current.latitude), lon: Number(current.longitude) },
  );

  if (distance < THRESHOLDS.impossibleTravelMinKm) return null;

  const elapsedHours =
    (Date.now() - previous.createdAt.getTime()) / (1000 * 60 * 60);
  // Avoid divide-by-zero on simultaneous logins.
  const speed = distance / Math.max(elapsedHours, 0.01);

  if (speed <= THRESHOLDS.impossibleTravelKmh) return null;

  const from = [previous.city, previous.country].filter(Boolean).join(", ");
  const to = [current.city, current.country].filter(Boolean).join(", ");

  return {
    type: "impossible_travel",
    severity: "critical",
    title: "Impossible travel detected",
    description: `Login from ${to || "unknown location"} is ${Math.round(
      distance,
    ).toLocaleString()} km from the previous login in ${from || "unknown location"} — ${Math.round(
      speed,
    ).toLocaleString()} km/h, which is not physically possible.`,
    riskScore: 95,
    action: "challenged",
    metadata: {
      distanceKm: Math.round(distance),
      speedKmh: Math.round(speed),
      elapsedMinutes: Math.round(elapsedHours * 60),
      from: { city: previous.city, country: previous.country },
      to: { city: current.city, country: current.country },
    },
  };
}

/** First successful login from a country the user has never used. */
export async function detectNewCountry(
  userId: string,
  current: IpInfo,
): Promise<ThreatFinding | null> {
  if (!current.country) return null;

  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loginHistory)
    .where(
      and(
        eq(loginHistory.userId, userId),
        eq(loginHistory.status, "success"),
        eq(loginHistory.country, current.country),
      ),
    );

  if ((row?.n ?? 0) > 0) return null;

  // If the user has no history at all, this is a first login — not an anomaly.
  const [total] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loginHistory)
    .where(
      and(eq(loginHistory.userId, userId), eq(loginHistory.status, "success")),
    );

  if ((total?.n ?? 0) === 0) return null;

  return {
    type: "new_country",
    severity: "medium",
    title: "Login from a new country",
    description: `First successful login from ${current.country}${
      current.city ? ` (${current.city})` : ""
    }.`,
    riskScore: 45,
    action: "alerted",
    metadata: { country: current.country, city: current.city },
  };
}

/** VPN / Tor / proxy / bot classification. */
export function classifyNetwork(
  info: IpInfo | null,
  isBot: boolean,
): ThreatFinding[] {
  const findings: ThreatFinding[] = [];

  if (isBot) {
    findings.push({
      type: "bot_login",
      severity: "high",
      title: "Automated client detected",
      description:
        "The sign-in request came from a headless browser or automation tool.",
      riskScore: 70,
      action: "challenged",
    });
  }

  if (info?.isTor) {
    findings.push({
      type: "tor_login",
      severity: "high",
      title: "Login through Tor",
      description:
        "This session originated from a Tor exit node, which masks the true origin.",
      riskScore: 60,
      action: "alerted",
      metadata: { exitNode: info.ip },
    });
  } else if (info?.isVpn) {
    findings.push({
      type: "vpn_login",
      severity: "low",
      title: "Login through VPN",
      description: "The session originated from a known VPN endpoint.",
      riskScore: 25,
      action: "logged",
      metadata: { org: info.org },
    });
  } else if (info?.isProxy) {
    findings.push({
      type: "vpn_login",
      severity: "medium",
      title: "Login through proxy",
      description: "The session originated from a known proxy service.",
      riskScore: 35,
      action: "logged",
      metadata: { org: info.org },
    });
  }

  return findings;
}

/** Volume-based detections that need the attempt already recorded. */
export async function detectVolumeAttacks(
  ctx: LoginContext,
): Promise<ThreatFinding[]> {
  const findings: ThreatFinding[] = [];
  const email = ctx.email.toLowerCase();

  if (!ctx.success) {
    const accountFailures = await countFailedForAccount(
      email,
      THRESHOLDS.bruteForceWindowMinutes,
    );

    if (accountFailures >= THRESHOLDS.bruteForcePerAccount) {
      findings.push({
        type: "brute_force",
        severity: "high",
        title: "Brute force attempt",
        description: `${accountFailures} failed sign-ins for ${email} in the last ${THRESHOLDS.bruteForceWindowMinutes} minutes.`,
        riskScore: 75,
        action: "blocked",
        metadata: { attempts: accountFailures, email },
      });
    }

    if (ctx.ip) {
      const ipFailures = await countFailedForIp(
        ctx.ip,
        THRESHOLDS.bruteForceIpWindowMinutes,
      );
      if (ipFailures >= THRESHOLDS.bruteForcePerIp) {
        findings.push({
          type: "brute_force",
          severity: "high",
          title: "Brute force from single IP",
          description: `${ipFailures} failed sign-ins from ${ctx.ip} in ${THRESHOLDS.bruteForceIpWindowMinutes} minutes.`,
          riskScore: 80,
          action: "blocked",
          metadata: { attempts: ipFailures, ip: ctx.ip },
        });
      }

      const accounts = await distinctAccountsForIp(
        ctx.ip,
        THRESHOLDS.sprayWindowMinutes,
      );
      if (accounts >= THRESHOLDS.sprayDistinctAccounts) {
        findings.push({
          type: "password_spray",
          severity: "critical",
          title: "Password spray detected",
          description: `${accounts} distinct accounts targeted from ${ctx.ip} in ${THRESHOLDS.sprayWindowMinutes} minutes.`,
          riskScore: 90,
          action: "blocked",
          metadata: { accounts, ip: ctx.ip },
        });
      }
    }
  }

  if (ctx.userId) {
    const ips = await distinctIpsForUser(
      ctx.userId,
      THRESHOLDS.multipleIpWindowMinutes,
    );
    if (ips >= THRESHOLDS.multipleIpThreshold) {
      findings.push({
        type: "multiple_ip_abuse",
        severity: "high",
        title: "Multiple IP addresses",
        description: `${ips} distinct IPs used by this account in ${THRESHOLDS.multipleIpWindowMinutes} minutes.`,
        riskScore: 70,
        action: "alerted",
        metadata: { ips },
      });
    }

    const devices = await distinctDevicesForUser(
      ctx.userId,
      THRESHOLDS.multipleDeviceWindowMinutes,
    );
    if (devices >= THRESHOLDS.multipleDeviceThreshold) {
      findings.push({
        type: "multiple_device_abuse",
        severity: "medium",
        title: "Multiple devices",
        description: `${devices} distinct devices used by this account in ${THRESHOLDS.multipleDeviceWindowMinutes} minutes.`,
        riskScore: 55,
        action: "alerted",
        metadata: { devices },
      });
    }
  }

  return findings;
}

/**
 * Credential stuffing: many accounts, one device fingerprint. Requires the
 * caller to pass a fingerprint; without one this check is skipped rather than
 * guessed.
 */
export async function detectCredentialStuffing(
  fingerprint: string | null | undefined,
  ip: string | null,
): Promise<ThreatFinding | null> {
  if (!fingerprint && !ip) return null;

  const identifier = fingerprint ?? ip!;
  const [row] = await db
    .select({
      n: sql<number>`count(distinct ${loginAttempt.identifier})::int`,
    })
    .from(loginAttempt)
    .where(
      and(
        eq(loginAttempt.ipAddress, identifier),
        gte(loginAttempt.createdAt, minutesAgo(THRESHOLDS.stuffingWindowMinutes)),
      ),
    );

  const accounts = row?.n ?? 0;
  if (accounts < THRESHOLDS.stuffingDistinctAccounts) return null;

  return {
    type: "credential_stuffing",
    severity: "critical",
    title: "Credential stuffing detected",
    description: `${accounts} accounts attempted from the same source in ${THRESHOLDS.stuffingWindowMinutes} minutes.`,
    riskScore: 92,
    action: "blocked",
    metadata: { accounts, identifier },
  };
}

/* -------------------------------------------------------------------------- */
/*                              Persistence                                   */
/* -------------------------------------------------------------------------- */

export async function persistThreat(
  finding: ThreatFinding,
  ctx: LoginContext,
  ipInfo?: IpInfo | null,
): Promise<string | null> {
  try {
    const id = crypto.randomUUID();
    await db.insert(securityEvent).values({
      id,
      userId: ctx.userId ?? null,
      type: finding.type,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      country: ipInfo?.country ?? null,
      city: ipInfo?.city ?? null,
      riskScore: finding.riskScore,
      status: "open",
      actionTaken: finding.action,
      metadata: finding.metadata ?? null,
    });

    await recordAudit({
      action: `security.${finding.type}`,
      category: "security",
      severity: finding.severity,
      actorId: ctx.userId ?? null,
      actorEmail: ctx.email,
      resourceType: "security_event",
      resourceId: id,
      description: finding.title,
      metadata: { ...finding.metadata, riskScore: finding.riskScore },
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return id;
  } catch (error) {
    console.error("[threat] failed to persist", finding.type, error);
    return null;
  }
}

export interface EvaluateLoginResult {
  findings: ThreatFinding[];
  riskScore: number;
  ipInfo: IpInfo | null;
  /** True when the highest-severity action is `blocked`. */
  blocked: boolean;
}

/**
 * Runs the full detection suite for a login event.
 *
 * Ordering: network classification first (cheap, already have the data), then
 * geo anomalies, then volume. Findings are persisted as they are produced so a
 * later failure cannot lose earlier evidence.
 */
export async function evaluateLogin(
  ctx: LoginContext,
  options: { parsedIsBot?: boolean } = {},
): Promise<EvaluateLoginResult> {
  const findings: ThreatFinding[] = [];
  const ipInfo = await getIpIntel(ctx.ip).catch(() => null);

  findings.push(...classifyNetwork(ipInfo, options.parsedIsBot ?? false));

  if (ctx.userId && ipInfo) {
    const [travel, country] = await Promise.all([
      detectImpossibleTravel(ctx.userId, ipInfo).catch(() => null),
      detectNewCountry(ctx.userId, ipInfo).catch(() => null),
    ]);
    if (travel) findings.push(travel);
    if (country) findings.push(country);
  }

  findings.push(...(await detectVolumeAttacks(ctx)));

  const stuffing = await detectCredentialStuffing(
    ctx.deviceFingerprint,
    ctx.ip,
  ).catch(() => null);
  if (stuffing) findings.push(stuffing);

  for (const finding of findings) {
    await persistThreat(finding, ctx, ipInfo);
  }

  const riskScore = findings.reduce(
    (max, finding) => Math.max(max, finding.riskScore),
    0,
  );

  return {
    findings,
    riskScore,
    ipInfo,
    blocked: findings.some((f) => f.action === "blocked"),
  };
}

/* -------------------------------------------------------------------------- */
/*                            Account lockout                                 */
/* -------------------------------------------------------------------------- */

export async function isAccountLocked(
  userId: string,
): Promise<{ locked: boolean; until: Date | null; reason: string | null }> {
  const [row] = await db
    .select({
      lockedUntil: user.lockedUntil,
      failedLoginCount: user.failedLoginCount,
      banned: user.banned,
      banReason: user.banReason,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!row) return { locked: false, until: null, reason: null };

  if (row.banned) {
    return {
      locked: true,
      until: null,
      reason: row.banReason ?? "Account suspended",
    };
  }

  if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
    return {
      locked: true,
      until: row.lockedUntil,
      reason: "Too many failed sign-in attempts",
    };
  }

  return { locked: false, until: null, reason: null };
}

export async function registerFailedLogin(
  userId: string | null,
  options: { threshold?: number; lockMinutes?: number } = {},
): Promise<{ locked: boolean; until: Date | null }> {
  if (!userId) return { locked: false, until: null };

  const threshold = options.threshold ?? THRESHOLDS.bruteForcePerAccount;
  const lockMinutes = options.lockMinutes ?? 15;

  try {
    const [row] = await db
      .select({ failedLoginCount: user.failedLoginCount })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!row) return { locked: false, until: null };

    const next = row.failedLoginCount + 1;

    if (next >= threshold) {
      const until = new Date(Date.now() + lockMinutes * 60 * 1000);
      await db
        .update(user)
        .set({ failedLoginCount: 0, lockedUntil: until })
        .where(eq(user.id, userId));
      return { locked: true, until };
    }

    await db
      .update(user)
      .set({ failedLoginCount: next })
      .where(eq(user.id, userId));

    return { locked: false, until: null };
  } catch (error) {
    console.error("[lockout] failed to register", error);
    return { locked: false, until: null };
  }
}

export async function clearFailedLogins(userId: string): Promise<void> {
  try {
    await db
      .update(user)
      .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(user.id, userId));
  } catch (error) {
    console.error("[lockout] failed to clear", error);
  }
}

/* -------------------------------------------------------------------------- */
/*                              Risk scoring                                  */
/* -------------------------------------------------------------------------- */

/**
 * Account security score (0-100). Higher is better.
 * Deliberately transparent: each deduction is a documented control gap.
 */
export interface SecurityScoreInput {
  mfaEnabled: boolean;
  passkeyCount: number;
  emailVerified: boolean;
  passwordAgeDays: number | null;
  activeSessions: number;
  trustedDevices: number;
  recentThreats: number;
  accountAgeDays: number;
}

export function computeSecurityScore(input: SecurityScoreInput): {
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  factors: Array<{ label: string; points: number; max: number; hint: string }>;
} {
  const factors = [
    {
      label: "Two-factor authentication",
      points: input.mfaEnabled ? 30 : 0,
      max: 30,
      hint: input.mfaEnabled
        ? "Authenticator app or email OTP is active."
        : "Enable 2FA to protect against stolen passwords.",
    },
    {
      label: "Passkey registered",
      points: input.passkeyCount > 0 ? 20 : 0,
      max: 20,
      hint:
        input.passkeyCount > 0
          ? `${input.passkeyCount} passkey${input.passkeyCount === 1 ? "" : "s"} registered.`
          : "Passkeys are phishing-resistant and faster than passwords.",
    },
    {
      label: "Email verified",
      points: input.emailVerified ? 15 : 0,
      max: 15,
      hint: input.emailVerified
        ? "Email ownership confirmed."
        : "Verify your email to enable account recovery.",
    },
    {
      label: "Password freshness",
      points:
        input.passwordAgeDays === null
          ? 15
          : input.passwordAgeDays <= 90
            ? 15
            : input.passwordAgeDays <= 180
              ? 8
              : 0,
      max: 15,
      hint:
        input.passwordAgeDays === null
          ? "No password in use (passwordless account)."
          : `Password is ${input.passwordAgeDays} days old.`,
    },
    {
      label: "Session hygiene",
      points: input.activeSessions <= 3 ? 10 : input.activeSessions <= 6 ? 5 : 0,
      max: 10,
      hint: `${input.activeSessions} active session${input.activeSessions === 1 ? "" : "s"}.`,
    },
    {
      label: "Threat history",
      points:
        input.recentThreats === 0 ? 10 : input.recentThreats <= 2 ? 5 : 0,
      max: 10,
      hint:
        input.recentThreats === 0
          ? "No security events in the last 30 days."
          : `${input.recentThreats} security event${input.recentThreats === 1 ? "" : "s"} in the last 30 days.`,
    },
  ];

  const score = Math.min(
    100,
    Math.max(0, factors.reduce((sum, f) => sum + f.points, 0)),
  );

  const grade =
    score >= 95
      ? "A+"
      : score >= 85
        ? "A"
        : score >= 70
          ? "B"
          : score >= 55
            ? "C"
            : score >= 40
              ? "D"
              : "F";

  return { score, grade, factors };
}
