import type { Severity } from "@/types/dashboard";
import type { ScanResult } from "@/types/scan";
import type { ScanModule } from "@/types/scanner";

export interface GeneratedFinding {
  fingerprint: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  cvss: number;
  remediation: string;
  evidence: Record<string, unknown>;
}

const HEADER_FINDINGS: Record<
  string,
  {
    fingerprint: string;
    title: string;
    description: string;
    severity: Severity;
    cvss: number;
    remediation: string;
  }
> = {
  hsts: {
    fingerprint: "headers:missing-hsts",
    title: "HSTS is not enforced",
    description:
      "The response does not send Strict-Transport-Security, so browsers may downgrade future requests to HTTP.",
    severity: "high",
    cvss: 7.4,
    remediation:
      "Send Strict-Transport-Security with a max-age of at least one year and includeSubDomains.",
  },
  csp: {
    fingerprint: "headers:missing-csp",
    title: "Content-Security-Policy is missing",
    description:
      "No Content-Security-Policy restricts script sources or framing, increasing the impact of injection flaws.",
    severity: "high",
    cvss: 7.5,
    remediation:
      "Deploy a restrictive Content-Security-Policy and roll it out in report-only mode before enforcement.",
  },
  xfo: {
    fingerprint: "headers:missing-x-frame-options",
    title: "X-Frame-Options is missing",
    description:
      "Without an anti-framing header the application may be embedded by a third-party origin.",
    severity: "medium",
    cvss: 5.3,
    remediation:
      "Set X-Frame-Options to DENY or add a CSP frame-ancestors directive.",
  },
  xcto: {
    fingerprint: "headers:missing-x-content-type-options",
    title: "MIME sniffing is not disabled",
    description:
      "The response omits X-Content-Type-Options: nosniff, allowing some browsers to interpret files as a different type.",
    severity: "medium",
    cvss: 5.3,
    remediation: "Send X-Content-Type-Options: nosniff on every response.",
  },
  referrer: {
    fingerprint: "headers:missing-referrer-policy",
    title: "Referrer-Policy is not configured",
    description:
      "URLs and query parameters may leak to third-party destinations through the Referer header.",
    severity: "low",
    cvss: 3.1,
    remediation:
      "Send a Referrer-Policy such as strict-origin-when-cross-origin.",
  },
  permissions: {
    fingerprint: "headers:missing-permissions-policy",
    title: "Permissions-Policy is not configured",
    description:
      "Browser capabilities such as camera, microphone and geolocation are not explicitly restricted.",
    severity: "low",
    cvss: 3.1,
    remediation:
      "Send a Permissions-Policy that disables capabilities the application does not need.",
  },
};

function portFinding(port: number, service: string): GeneratedFinding | null {
  if (!COMMON_PORT_RULES[port]) return null;
  const rule = COMMON_PORT_RULES[port];
  return {
    fingerprint: `ports:${port}-open`,
    title: `Exposed ${service} service on port ${port}`,
    description: `Port ${port} (${service}) is reachable from the public internet. ${rule.description}`,
    severity: rule.severity,
    category: "Exposed services",
    cvss: rule.cvss,
    remediation: rule.remediation,
    evidence: { port, service },
  };
}

const COMMON_PORT_RULES: Record<
  number,
  {
    severity: Severity;
    cvss: number;
    description: string;
    remediation: string;
  }
> = {
  21: {
    severity: "high",
    cvss: 7.5,
    description: "FTP frequently exposes credentials and file-system access.",
    remediation: "Restrict FTP to a private network or replace it with SFTP.",
  },
  22: {
    severity: "medium",
    cvss: 5.3,
    description: "SSH exposure increases credential and brute-force risk.",
    remediation:
      "Restrict SSH to trusted networks, disable password authentication and enforce keys.",
  },
  25: {
    severity: "medium",
    cvss: 5.3,
    description: "Public SMTP can be abused for relay or address harvesting.",
    remediation: "Restrict SMTP to known mail relays and require authentication.",
  },
  80: {
    severity: "low",
    cvss: 3.1,
    description: "Plain HTTP allows interception and downgrade attacks.",
    remediation: "Redirect all HTTP traffic to HTTPS and enable HSTS.",
  },
  3306: {
    severity: "critical",
    cvss: 9.1,
    description: "A public database port can expose the full data store.",
    remediation: "Remove public database access and use a private network or proxy.",
  },
  5432: {
    severity: "critical",
    cvss: 9.1,
    description: "A public database port can expose the full data store.",
    remediation: "Remove public database access and use a private network or proxy.",
  },
};

/**
 * Converts a passive scan result into normalized findings. The functions are
 * module-aware so a header-only profile does not report TLS or port findings.
 */
export function generateFindings(
  result: ScanResult,
  modules: ScanModule[],
): GeneratedFinding[] {
  const selected = new Set(modules);
  const findings: GeneratedFinding[] = [];

  if (selected.has("http") && !result.https) {
    findings.push({
      fingerprint: "transport:no-https",
      title: "Target is served over plain HTTP",
      description:
        "The primary response was not delivered over TLS, exposing traffic to interception and tampering.",
      severity: "high",
      category: "Transport security",
      cvss: 7.4,
      remediation: "Serve the asset over HTTPS and redirect all HTTP requests.",
      evidence: { url: result.url },
    });
  }

  if (selected.has("headers")) {
    for (const key of result.missingHeaders) {
      const meta = HEADER_FINDINGS[key];
      if (!meta) continue;
      findings.push({
        ...meta,
        category: "Security headers",
        evidence: { header: key },
      });
    }

    if (!result.clickjacking.protected) {
      findings.push({
        fingerprint: "headers:clickjacking",
        title: "Application can be framed by another origin",
        description: result.clickjacking.reason,
        severity: "medium",
        category: "Security headers",
        cvss: 5.3,
        remediation:
          "Set X-Frame-Options: DENY or use CSP frame-ancestors 'none'.",
        evidence: { xfo: result.securityHeaders.xfo, csp: result.securityHeaders.csp },
      });
    }
  }

  if (selected.has("tls") && result.https) {
    if (!result.ssl.valid) {
      findings.push({
        fingerprint: "tls:invalid-certificate",
        title: "TLS certificate is invalid or expired",
        description: `The certificate reported by the target is not currently valid (${result.ssl.issuer}).`,
        severity: "high",
        category: "TLS",
        cvss: 7.4,
        remediation: "Renew the certificate and automate expiry monitoring.",
        evidence: { ...result.ssl },
      });
    } else if (result.ssl.daysRemaining <= 30) {
      findings.push({
        fingerprint: "tls:expiring-certificate",
        title: "TLS certificate expires soon",
        description: `The certificate expires in ${result.ssl.daysRemaining} days.`,
        severity: result.ssl.daysRemaining <= 7 ? "high" : "medium",
        category: "TLS",
        cvss: result.ssl.daysRemaining <= 7 ? 7.4 : 5.3,
        remediation:
          "Renew the certificate before expiry and verify automated renewal.",
        evidence: { ...result.ssl },
      });
    }
  }

  if (selected.has("cookies") && result.cookieAnalysis.present) {
    if (!result.cookieAnalysis.secure) {
      findings.push({
        fingerprint: "cookies:not-secure",
        title: "Session cookie is not marked Secure",
        description:
          "A cookie was returned without the Secure attribute, allowing transmission over plain HTTP.",
        severity: "medium",
        category: "Cookies",
        cvss: 5.3,
        remediation: "Set Secure on all session cookies.",
        evidence: { sameSite: result.cookieAnalysis.sameSite },
      });
    }
    if (!result.cookieAnalysis.httpOnly) {
      findings.push({
        fingerprint: "cookies:not-http-only",
        title: "Session cookie is readable by JavaScript",
        description:
          "A cookie was returned without HttpOnly, increasing the impact of cross-site scripting.",
        severity: "medium",
        category: "Cookies",
        cvss: 5.3,
        remediation: "Set HttpOnly on all session cookies.",
        evidence: { sameSite: result.cookieAnalysis.sameSite },
      });
    }
    if (result.cookieAnalysis.sameSite === "Not Set") {
      findings.push({
        fingerprint: "cookies:no-samesite",
        title: "Cookie SameSite policy is missing",
        description:
          "The cookie does not declare SameSite, leaving browser cross-site behaviour ambiguous.",
        severity: "low",
        category: "Cookies",
        cvss: 3.1,
        remediation: "Set SameSite=Lax or Strict on session cookies.",
        evidence: { sameSite: result.cookieAnalysis.sameSite },
      });
    }
  }

  if (selected.has("cors") && result.cors.risk === "High") {
    findings.push({
      fingerprint: "cors:wildcard-origin",
      title: "CORS allows any origin",
      description:
        "Access-Control-Allow-Origin is set to *, allowing arbitrary sites to read responses where credentials are not required.",
      severity: "high",
      category: "CORS",
      cvss: 7.1,
      remediation:
        "Replace wildcard CORS with an explicit allowlist of trusted origins.",
      evidence: { ...result.cors },
    });
  }

  if (selected.has("ports")) {
    for (const port of result.ports) {
      const generated = portFinding(port.port, port.service);
      if (generated) findings.push(generated);
    }
  }

  if (selected.has("technology")) {
    const stack = [result.server, result.poweredBy].filter(
      (value) => value && value !== "Unknown" && value !== "Hidden",
    );
    if (stack.length > 0) {
      findings.push({
        fingerprint: "technology:version-disclosure",
        title: "Server technology is disclosed",
        description:
          "Response headers reveal the server or application stack, which helps an attacker target known weaknesses.",
        severity: "informational",
        category: "Technology",
        cvss: 0,
        remediation:
          "Remove version-bearing Server and X-Powered-By headers at the edge.",
        evidence: {
          server: result.server,
          poweredBy: result.poweredBy,
        },
      });
    }
  }

  return findings;
}
