import "server-only";

import { promises as dns } from "dns";
import net from "net";
import tls from "tls";

import { isPrivateIp } from "@/lib/security/ip-intel";
import type {
  ClickjackingAnalysis,
  CookieAnalysis,
  CorsAnalysis,
  PortAnalysis,
  RobotsAnalysis,
  ScanResult,
  SSLAnalysis,
} from "@/types/scan";
import type { ScanModule } from "@/types/scanner";
import {
  generateFindings,
  type GeneratedFinding,
} from "@/services/scanner/findings";

export const FETCH_TIMEOUT_MS = 20_000;
export const PORT_TIMEOUT_MS = 1_200;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "instance-data",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const COMMON_PORTS = [
  { port: 443, service: "HTTPS", risk: "Low" },
  { port: 80, service: "HTTP", risk: "Medium" },
  { port: 22, service: "SSH", risk: "Review" },
  { port: 21, service: "FTP", risk: "High" },
  { port: 25, service: "SMTP", risk: "Medium" },
  { port: 3306, service: "MySQL", risk: "Critical" },
  { port: 5432, service: "PostgreSQL", risk: "Critical" },
] as const;

export interface ScanProgressEvent {
  progress: number;
  module: ScanModule | "dns" | "scoring" | "complete";
  label: string;
}

export interface ScanTargetOptions {
  modules: ScanModule[];
  onProgress?: (event: ScanProgressEvent) => void | Promise<void>;
}

export interface ScanEngineResult {
  result: ScanResult & {
    riskLevel: "critical" | "high" | "medium" | "low" | "none";
    riskScore: number;
    findingCount: number;
    securityScore: number;
    scannableModules: ScanModule[];
  };
  findings: GeneratedFinding[];
  resolvedUrl: string;
  ipAddress: string | null;
}

function certificateField(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value.join(", ") : value;
}

/**
 * Rejects targets that resolve to private, loopback, link-local or CGNAT
 * address space. A scanner that can be pointed at `169.254.169.254` is itself
 * the vulnerability, so this runs before any socket is opened.
 */
export async function assertPublicTarget(rawUrl: string): Promise<URL> {
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

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) {
    throw new Error("Target hostname did not resolve.");
  }
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new Error("Target resolves to the internal network and is refused.");
  }

  return parsed;
}

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

async function analyzePorts(hostname: string): Promise<PortAnalysis[]> {
  const results: PortAnalysis[] = [];
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

function riskFromScore(
  score: number,
): "critical" | "high" | "medium" | "low" | "none" {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  if (score > 0) return "low";
  return "none";
}

const EMPTY_SSL: SSLAnalysis = {
  enabled: false,
  valid: false,
  issuer: "Not audited",
  validFrom: "",
  validTo: "",
  daysRemaining: 0,
  protocol: "Not audited",
};

function isSelected(modules: Set<ScanModule>, module: ScanModule): boolean {
  return modules.has(module);
}

/**
 * Passive target assessment shared by the direct scanner and the scan queue.
 * Only modules selected by the profile are scored and turned into findings;
 * response metadata is still captured so reports remain useful.
 */
export async function executeTargetScan(
  target: string,
  options: ScanTargetOptions,
): Promise<ScanEngineResult> {
  const modules = new Set(options.modules);
  const resolved = await assertPublicTarget(target);
  const hostname = resolved.hostname;

  const progress = async (
    percent: number,
    module: ScanProgressEvent["module"],
    label: string,
  ) => {
    await options.onProgress?.({ progress: percent, module, label });
  };

  await progress(5, "dns", "Resolving target");

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  const ipAddress = records[0]?.address ?? null;

  await progress(15, "http", "Fetching HTTP response");
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

  if (isSelected(modules, "headers")) {
    await progress(30, "headers", "Analysing security headers");
  }
  if (isSelected(modules, "technology")) {
    await progress(42, "technology", "Fingerprinting technology");
  }

  let ssl: SSLAnalysis = EMPTY_SSL;
  if (isSelected(modules, "tls")) {
    await progress(54, "tls", "Inspecting TLS certificate");
    ssl =
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
  }

  if (isSelected(modules, "cookies")) {
    await progress(64, "cookies", "Checking cookie controls");
  }

  if (isSelected(modules, "cors")) {
    await progress(70, "cors", "Evaluating CORS policy");
  }

  let robots: RobotsAnalysis = {
    found: false,
    url: "",
    size: 0,
    disallowCount: 0,
    sitemap: false,
  };
  if (isSelected(modules, "robots")) {
    await progress(76, "robots", "Reading robots.txt");
    try {
      const robotsUrl = new URL("/robots.txt", resolved).toString();
      const robotsRes = await fetch(robotsUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
        headers: {
          "user-agent": "1Security-Scanner/2.0 (+https://1security.app)",
        },
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
      // robots.txt is optional.
    }
  }

  let ports: PortAnalysis[] = [];
  if (isSelected(modules, "ports")) {
    await progress(84, "ports", "Probing common service ports");
    ports = await analyzePorts(hostname);
  }

  await progress(94, "scoring", "Calculating risk and normalising findings");

  let securityScore = 100;
  if (isSelected(modules, "headers")) {
    securityScore -= missingHeaders.length * 8;
    if (!clickjackingProtected) securityScore -= 15;
  }
  if (isSelected(modules, "cookies")) {
    if (cookieAnalysis.present && !cookieAnalysis.secure) securityScore -= 5;
    if (cookieAnalysis.present && !cookieAnalysis.httpOnly) securityScore -= 5;
  }
  if (isSelected(modules, "cors")) {
    if (cors.risk === "High") securityScore -= 10;
  }
  if (isSelected(modules, "tls") && resolved.protocol === "https:") {
    if (!ssl.valid) securityScore -= 15;
  }
  if (isSelected(modules, "http") && resolved.protocol !== "https:") {
    securityScore -= 10;
  }
  securityScore = Math.max(0, securityScore);

  let riskScore = 100 - securityScore;
  if (isSelected(modules, "http") && resolved.protocol !== "https:") {
    riskScore += 20;
  }
  if (
    isSelected(modules, "tls") &&
    resolved.protocol === "https:" &&
    !ssl.valid
  ) {
    riskScore += 20;
  }
  for (const port of ports) {
    if (port.risk === "Critical") riskScore += 25;
    else if (port.risk === "High") riskScore += 15;
    else if (port.risk === "Review") riskScore += 8;
    else if (port.risk === "Medium") riskScore += 5;
  }
  riskScore = Math.min(100, Math.max(0, riskScore));

  const riskLevel = riskFromScore(riskScore);

  const baseResult: ScanResult = {
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

  const findings = generateFindings(baseResult, options.modules);
  const result = {
    ...baseResult,
    riskLevel,
    riskScore,
    findingCount: findings.length,
    securityScore,
    scannableModules: options.modules,
  };

  await progress(100, "complete", "Scan complete");

  return {
    result,
    findings,
    resolvedUrl: resolved.toString(),
    ipAddress,
  };
}
