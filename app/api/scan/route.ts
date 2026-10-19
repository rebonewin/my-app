import { NextRequest, NextResponse } from "next/server";
import tls from "tls";
import net from "net";
import { promises as dns } from "dns";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { resolveActor } from "@/lib/auth/actor";
import { db } from "@/lib/db";
import { scan } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";
import { isPrivateIp } from "@/lib/security/ip-intel";
import type {
  ClickjackingAnalysis,
  CookieAnalysis,
  CorsAnalysis,
  PortAnalysis,
  RobotsAnalysis,
  SSLAnalysis,
  ScanResult,
} from "@/types/scan";

/** Certificate fields may be a single value or a list, per Node's typings. */
function certificateField(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value.join(", ") : value;
}

const bodySchema = z.object({
  url: z
    .string()
    .trim()
    .min(4)
    .max(2048)
    .transform((value) =>
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    )
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "Only http and https targets are supported."),
});

const SCAN_COOLDOWN_MINUTES = 5;
const SCAN_COOLDOWN_LIMIT = 10;
const FETCH_TIMEOUT_MS = 20_000;
const PORT_TIMEOUT_MS = 1_200;

/* -------------------------------------------------------------------------- */
/*                            SSRF protection                                 */
/* -------------------------------------------------------------------------- */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "instance-data",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

/**
 * Rejects targets that resolve to private, loopback, link-local or CGNAT
 * address space. A security scanner that can be pointed at
 * `169.254.169.254` is itself the vulnerability, so this runs before any
 * socket is opened.
 */
async function assertPublicTarget(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("Targets on the internal network are not permitted.");
  }
  if (
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".home.arpa")
  ) {
    throw new Error("Targets on the internal network are not permitted.");
  }
  if (isPrivateIp(hostname)) {
    throw new Error("Targets on the internal network are not permitted.");
  }

  // Resolve every record, not just the first: a DNS rebinding answer that
  // mixes a public and a private address must be refused outright.
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) {
    throw new Error("Target hostname did not resolve.");
  }
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new Error("Target resolves to the internal network and is refused.");
  }

  return parsed;
}

/* -------------------------------------------------------------------------- */
/*                             TLS certificate                                */
/* -------------------------------------------------------------------------- */

function analyzeSSL(url: string): Promise<SSLAnalysis> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (value: SSLAnalysis) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const unavailable: SSLAnalysis = {
      enabled: false,
      valid: false,
      issuer: "Unknown",
      validFrom: "",
      validTo: "",
      daysRemaining: 0,
      protocol: "Unknown",
    };

    try {
      const hostname = new URL(url).hostname;
      const socket = tls.connect(
        {
          host: hostname,
          port: 443,
          servername: hostname,
          rejectUnauthorized: false,
        },
        () => {
          const cert = socket.getPeerCertificate();
          const protocol = socket.getProtocol();
          socket.end();

          if (!cert || !cert.valid_from) {
            finish(unavailable);
            return;
          }

          const validTo = new Date(cert.valid_to);
          const daysRemaining = Math.floor(
            (validTo.getTime() - Date.now()) / 86_400_000,
          );

          finish({
            enabled: true,
            valid: daysRemaining > 0,
            issuer:
              certificateField(cert.issuer?.O) ??
              certificateField(cert.issuer?.CN) ??
              "Unknown",
            validFrom: new Date(cert.valid_from).toISOString(),
            validTo: validTo.toISOString(),
            daysRemaining,
            protocol: protocol || "Unknown",
          });
        },
      );

      socket.setTimeout(8_000, () => {
        socket.destroy();
        finish(unavailable);
      });
      socket.on("error", () => finish(unavailable));
    } catch {
      finish(unavailable);
    }
  });
}

/* -------------------------------------------------------------------------- */
/*                                Port probe                                  */
/* -------------------------------------------------------------------------- */

function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (open: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(PORT_TIMEOUT_MS);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

const COMMON_PORTS = [
  { port: 443, service: "HTTPS", risk: "Low" },
  { port: 80, service: "HTTP", risk: "Medium" },
  { port: 22, service: "SSH", risk: "Review" },
  { port: 21, service: "FTP", risk: "High" },
  { port: 25, service: "SMTP", risk: "Medium" },
  { port: 3306, service: "MySQL", risk: "High" },
  { port: 5432, service: "PostgreSQL", risk: "High" },
] as const;

async function analyzePorts(hostname: string): Promise<PortAnalysis[]> {
  const results: PortAnalysis[] = [];
  // Bounded concurrency keeps the scan under ten seconds without opening
  // dozens of sockets at once.
  for (const item of COMMON_PORTS) {
    if (await checkPort(hostname, item.port)) {
      results.push({
        port: item.port,
        service: item.service,
        status: "Open",
        risk: item.risk,
      });
    }
  }
  return results;
}

/* -------------------------------------------------------------------------- */
/*                              Risk scoring                                  */
/* -------------------------------------------------------------------------- */

function riskFromScore(score: number): "critical" | "high" | "medium" | "low" | "none" {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  if (score > 0) return "low";
  return "none";
}

/* -------------------------------------------------------------------------- */
/*                                    POST                                    */
/* -------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  const actor = await resolveActor(req, "scanner:start");

  if (!actor) {
    return NextResponse.json(
      {
        error:
          "Authentication required. Supply a session cookie or a Bearer API key with scanner:start.",
      },
      { status: 401 },
    );
  }

  const ip = clientIpFromHeaders(req.headers);
  const startedAt = Date.now();

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? (error.issues[0]?.message ?? "Invalid request.")
            : "Invalid request body.",
      },
      { status: 400 },
    );
  }

  const target = parsed.url;

  // Per-user scan budget. Counted in the database so it survives cold starts
  // and applies across every server instance.
  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(scan)
    .where(
      and(
        eq(scan.userId, actor.id),
        gte(
          scan.createdAt,
          new Date(Date.now() - SCAN_COOLDOWN_MINUTES * 60 * 1000),
        ),
      ),
    );

  if ((recent ?? 0) >= SCAN_COOLDOWN_LIMIT) {
    return NextResponse.json(
      {
        error: `Scan limit reached: ${SCAN_COOLDOWN_LIMIT} scans per ${SCAN_COOLDOWN_MINUTES} minutes.`,
      },
      { status: 429 },
    );
  }

  let resolved: URL;
  try {
    resolved = await assertPublicTarget(target);
  } catch (error) {
    await recordAudit({
      action: "scanner.blocked_target",
      category: "scanner",
      severity: "medium",
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role ?? null,
      description: `Blocked scan target: ${target}`,
      metadata: {
        reason: error instanceof Error ? error.message : "unknown",
      },
      ipAddress: ip,
      success: false,
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Target could not be scanned.",
      },
      { status: 400 },
    );
  }

  const scanId = crypto.randomUUID();
  const hostname = resolved.hostname;

  await db.insert(scan).values({
    id: scanId,
    userId: actor.id,
    organizationId: actor.activeOrganizationId,
    target,
    hostname,
    status: "running",
  });

  try {
    const fetchStart = Date.now();
    const response = await fetch(resolved.toString(), {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "user-agent": "1Security-Scanner/2.0 (+https://1security.app)",
      },
    });
    const responseTime = Date.now() - fetchStart;

    const headers = response.headers;

    const ssl =
      resolved.protocol === "https:"
        ? await analyzeSSL(target)
        : {
            enabled: false,
            valid: false,
            issuer: "Not HTTPS",
            validFrom: "",
            validTo: "",
            daysRemaining: 0,
            protocol: "None",
          };

    const ports = await analyzePorts(hostname);

    const securityHeaders = {
      hsts: headers.get("strict-transport-security"),
      csp: headers.get("content-security-policy"),
      xfo: headers.get("x-frame-options"),
      xcto: headers.get("x-content-type-options"),
      referrer: headers.get("referrer-policy"),
      permissions: headers.get("permissions-policy"),
    };

    const missingHeaders = Object.entries(securityHeaders)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    const cookieHeader = headers.get("set-cookie") ?? "";
    const cookieAnalysis: CookieAnalysis = {
      present: cookieHeader.length > 0,
      secure: cookieHeader.toLowerCase().includes("secure"),
      httpOnly: cookieHeader.toLowerCase().includes("httponly"),
      sameSite:
        cookieHeader.match(/samesite=(strict|lax|none)/i)?.[1] ?? "Not Set",
    };

    const cors: CorsAnalysis = {
      origin: headers.get("access-control-allow-origin"),
      credentials: headers.get("access-control-allow-credentials"),
      methods: headers.get("access-control-allow-methods"),
      headers: headers.get("access-control-allow-headers"),
      risk: "Safe",
    };

    if (cors.origin === "*") cors.risk = "High";
    else if (cors.origin) cors.risk = "Medium";

    let robots: RobotsAnalysis = {
      found: false,
      url: "",
      size: 0,
      disallowCount: 0,
      sitemap: false,
    };

    try {
      const robotsUrl = new URL("/robots.txt", resolved).toString();
      const robotsRes = await fetch(robotsUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      });
      if (robotsRes.ok) {
        const text = await robotsRes.text();
        robots = {
          found: true,
          url: robotsUrl,
          size: text.length,
          disallowCount: (text.match(/^Disallow:/gim) || []).length,
          sitemap: /Sitemap:/i.test(text),
        };
      }
    } catch {
      // robots.txt is optional
    }

    const clickjackingProtected =
      Boolean(securityHeaders.xfo) ||
      Boolean(securityHeaders.csp?.includes("frame-ancestors"));

    const clickjacking: ClickjackingAnalysis = {
      protected: clickjackingProtected,
      severity: clickjackingProtected ? "None" : "Medium",
      reason: clickjackingProtected
        ? "X-Frame-Options or CSP frame-ancestors is configured."
        : "No anti-framing protection detected.",
    };

    let securityScore = 100;
    securityScore -= missingHeaders.length * 8;
    if (!clickjackingProtected) securityScore -= 15;
    if (cors.risk === "High") securityScore -= 10;
    if (!cookieAnalysis.secure) securityScore -= 5;
    securityScore = Math.max(0, securityScore);

    /* ---------------------------- risk rollup ---------------------------- */

    let riskScore = 100 - securityScore;
    if (resolved.protocol !== "https:") riskScore += 20;
    if (!ssl.valid && resolved.protocol === "https:") riskScore += 20;

    const elevatedPorts = ports.filter(
      (p) => p.risk === "High" || p.risk === "Review",
    );
    riskScore += elevatedPorts.length * 15;
    riskScore = Math.min(100, Math.max(0, riskScore));

    const riskLevel = riskFromScore(riskScore);

    const findingCount =
      missingHeaders.length +
      (clickjackingProtected ? 0 : 1) +
      (cors.risk === "High" ? 1 : 0) +
      (cookieAnalysis.present && !cookieAnalysis.secure ? 1 : 0) +
      elevatedPorts.length +
      (resolved.protocol !== "https:" ? 1 : 0);

    const result: ScanResult & {
      scanId: string;
      riskLevel: string;
      riskScore: number;
      findingCount: number;
    } = {
      scanId,
      riskLevel,
      riskScore,
      findingCount,
      url: target,
      status: response.status,
      responseTime,
      https: resolved.protocol === "https:",
      server: headers.get("server") || "Unknown",
      contentType: headers.get("content-type") || "Unknown",
      poweredBy: headers.get("x-powered-by") || "Hidden",
      cacheControl: headers.get("cache-control") || "Not Set",
      contentLength: headers.get("content-length") || "Unknown",
      securityHeaders,
      missingHeaders,
      securityScore,
      cookieAnalysis,
      cors,
      robots,
      clickjacking,
      ssl,
      ports,
    };

    await db
      .update(scan)
      .set({
        status: "completed",
        riskLevel,
        riskScore,
        findingCount,
        highCount: riskLevel === "high" || riskLevel === "critical" ? findingCount : 0,
        mediumCount: riskLevel === "medium" ? findingCount : 0,
        lowCount: riskLevel === "low" ? findingCount : 0,
        results: result,
        durationMs: Date.now() - startedAt,
        completedAt: new Date(),
      })
      .where(eq(scan.id, scanId));

    await recordAudit({
      action: "scanner.scan_completed",
      category: "scanner",
      severity:
        riskLevel === "critical" || riskLevel === "high" ? "high" : "info",
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role ?? null,
      organizationId: actor.activeOrganizationId,
      resourceType: "scan",
      resourceId: scanId,
      description: `Scanned ${target}: ${riskLevel} risk (${riskScore}/100).`,
      metadata: {
        riskLevel,
        riskScore,
        findingCount,
        responseStatus: response.status,
        openPorts: ports.map((p) => p.port),
      },
      ipAddress: ip,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The target did not respond within 20 seconds."
        : "Unable to scan target.";

    await db
      .update(scan)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
        durationMs: Date.now() - startedAt,
        completedAt: new Date(),
      })
      .where(eq(scan.id, scanId))
      .catch(() => undefined);

    await recordAudit({
      action: "scanner.scan_failed",
      category: "scanner",
      severity: "medium",
      actorId: actor.id,
      actorEmail: actor.email,
      organizationId: actor.activeOrganizationId,
      resourceType: "scan",
      resourceId: scanId,
      description: `Scan of ${target} failed.`,
      metadata: {
        error: error instanceof Error ? error.message : "unknown",
      },
      ipAddress: ip,
      success: false,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
