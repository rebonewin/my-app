import { Badge, Card, CardBody, CardHeader, severityTone } from "@/components/ui/card";
import { CheckIcon, XIcon } from "@/components/ui/icons";
import type { ScanResult as ScanResultType } from "@/types/scan";

type Props = {
  result: ScanResultType & {
    riskLevel?: string;
    riskScore?: number;
    findingCount?: number;
  };
};

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm text-slate-100">{value}</p>
    </div>
  );
}

export default function ScanResultView({ result }: Props) {
  const headers = result.securityHeaders;
  const headerRows = [
    { title: "Strict-Transport-Security", value: headers.hsts },
    { title: "Content-Security-Policy", value: headers.csp },
    { title: "X-Frame-Options", value: headers.xfo },
    { title: "X-Content-Type-Options", value: headers.xcto },
    { title: "Referrer-Policy", value: headers.referrer },
    { title: "Permissions-Policy", value: headers.permissions },
  ];

  const risk = result.riskLevel ?? "unknown";

  return (
    <div className="space-y-5">
      {/* Summary */}
      <Card>
        <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={severityTone(risk)}>{risk.toUpperCase()} RISK</Badge>
              <Badge tone={result.https ? "green" : "red"}>
                {result.https ? "HTTPS" : "HTTP only"}
              </Badge>
              <Badge tone="neutral">{result.status}</Badge>
            </div>
            <h2 className="mt-2 truncate font-mono text-sm text-slate-200">
              {result.url}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {result.missingHeaders.length} missing security header(s) ·{" "}
              {result.responseTime} ms · {result.findingCount ?? "—"} findings
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-5">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Risk
              </p>
              <p className="font-mono text-3xl font-semibold text-white">
                {result.riskScore ?? "—"}
              </p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Hygiene
              </p>
              <p className="font-mono text-3xl font-semibold text-cyan-300">
                {result.securityScore}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Facts */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Target host" value={result.url} />
        <Metric label="HTTP status" value={result.status} />
        <Metric label="Response time" value={`${result.responseTime} ms`} />
        <Metric label="Server" value={result.server} />
        <Metric label="Powered by" value={result.poweredBy} />
        <Metric label="Content type" value={result.contentType} />
        <Metric label="Cache control" value={result.cacheControl} />
        <Metric label="Content length" value={result.contentLength} />
        <Metric
          label="TLS protocol"
          value={result.ssl.enabled ? result.ssl.protocol : "Not enabled"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Headers */}
        <Card>
          <CardHeader
            title="Security headers"
            description={`${result.missingHeaders.length} missing of ${headerRows.length}`}
            action={
              <Badge tone={result.missingHeaders.length ? "amber" : "green"}>
                {result.missingHeaders.length ? "Incomplete" : "Complete"}
              </Badge>
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-white/[0.05]">
              {headerRows.map((header) => (
                <li
                  key={header.title}
                  className="flex items-center gap-3 px-5 py-2.5"
                >
                  <span
                    className={
                      header.value
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"
                        : "flex h-5 w-5 items-center justify-center rounded-full bg-red-400/15 text-red-300"
                    }
                  >
                    {header.value ? <CheckIcon size={11} /> : <XIcon size={11} />}
                  </span>
                  <span className="w-48 shrink-0 text-xs text-slate-300">
                    {header.title}
                  </span>
                  <span className="min-w-0 truncate font-mono text-[11px] text-slate-500">
                    {header.value ?? "not set"}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {/* TLS */}
        <Card>
          <CardHeader
            title="TLS certificate"
            description="Issuer, validity window and negotiated protocol"
            action={
              <Badge tone={result.ssl.valid ? "green" : "red"}>
                {result.ssl.valid ? "Valid" : "Invalid"}
              </Badge>
            }
          />
          <CardBody className="space-y-3">
            <Metric label="Issuer" value={result.ssl.issuer} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Valid from"
                value={
                  result.ssl.validFrom
                    ? new Date(result.ssl.validFrom).toLocaleDateString("en-GB")
                    : "—"
                }
              />
              <Metric
                label="Valid to"
                value={
                  result.ssl.validTo
                    ? new Date(result.ssl.validTo).toLocaleDateString("en-GB")
                    : "—"
                }
              />
            </div>
            <Metric
              label="Days remaining"
              value={
                result.ssl.daysRemaining > 0
                  ? `${result.ssl.daysRemaining} days`
                  : "Expired"
              }
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Ports */}
        <Card>
          <CardHeader
            title="Exposed services"
            description="Common ports reachable from the internet"
            action={
              <Badge
                tone={
                  result.ports.some((p) => p.risk === "High") ? "red" : "neutral"
                }
              >
                {result.ports.length} open
              </Badge>
            }
          />
          <CardBody className="p-0">
            {result.ports.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-slate-500">
                No common ports responded.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {result.ports.map((port) => (
                  <li
                    key={port.port}
                    className="flex items-center justify-between px-5 py-2.5"
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-300">
                        {port.port}
                      </span>
                      <span className="text-xs text-slate-400">
                        {port.service}
                      </span>
                    </span>
                    <Badge tone={severityTone(port.risk)}>{port.risk}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Cookies / CORS / framing */}
        <Card>
          <CardHeader
            title="Browser protections"
            description="Cookie flags, CORS policy and framing controls"
          />
          <CardBody className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                Cookies
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge tone={result.cookieAnalysis.present ? "green" : "neutral"}>
                  {result.cookieAnalysis.present ? "Present" : "None set"}
                </Badge>
                <Badge tone={result.cookieAnalysis.secure ? "green" : "red"}>
                  Secure {result.cookieAnalysis.secure ? "on" : "off"}
                </Badge>
                <Badge tone={result.cookieAnalysis.httpOnly ? "green" : "amber"}>
                  HttpOnly {result.cookieAnalysis.httpOnly ? "on" : "off"}
                </Badge>
                <Badge
                  tone={
                    result.cookieAnalysis.sameSite === "Not Set" ? "amber" : "green"
                  }
                >
                  SameSite {result.cookieAnalysis.sameSite}
                </Badge>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                CORS
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge tone={severityTone(result.cors.risk)}>
                  {result.cors.risk} risk
                </Badge>
                <Badge tone="neutral">
                  Origin {result.cors.origin ?? "not set"}
                </Badge>
                <Badge tone="neutral">
                  Credentials {result.cors.credentials ?? "no"}
                </Badge>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                Clickjacking
              </p>
              <p className="text-xs text-slate-400">
                {result.clickjacking.reason}
              </p>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                robots.txt
              </p>
              <p className="text-xs text-slate-400">
                {result.robots.found
                  ? `${result.robots.size} bytes · ${result.robots.disallowCount} disallow rules${result.robots.sitemap ? " · sitemap declared" : ""}`
                  : "Not published."}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
