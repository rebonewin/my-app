import InfoCard from "./cards/InfoCard";
import type { ScanResult as ScanResultType } from "@/types/scan";

type Props = {
  result: ScanResultType;
};

export default function ScanResult({ result }: Props) {
  const headers = result.securityHeaders;

  const securityHeaders = [
    {
      title: "Strict-Transport-Security",
      value: headers.hsts,
    },
    {
      title: "Content-Security-Policy",
      value: headers.csp,
    },
    {
      title: "X-Frame-Options",
      value: headers.xfo,
    },
    {
      title: "X-Content-Type-Options",
      value: headers.xcto,
    },
    {
      title: "Referrer-Policy",
      value: headers.referrer,
    },
    {
      title: "Permissions-Policy",
      value: headers.permissions,
    },
  ];

  return (
    <div className="mt-10 space-y-8">

      {/* ================= REPORT ================= */}

      <div className="rounded-2xl border border-cyan-500 bg-slate-900 p-8 shadow-2xl">

        <h2 className="text-3xl font-bold text-cyan-400">
          Scan Report
        </h2>

        <p className="mt-2 text-gray-400">
          Website analyzed successfully.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">

          <InfoCard
            title="Target"
            value={result.url}
            color="text-cyan-300"
          />

          <InfoCard
            title="HTTP Status"
            value={result.status}
            color="text-green-400"
          />

          <InfoCard
            title="HTTPS"
            value={result.https ? "Enabled" : "Disabled"}
            color={result.https ? "text-green-400" : "text-red-400"}
          />

          <InfoCard
            title="Server"
            value={result.server}
          />

          <InfoCard
            title="Powered By"
            value={result.poweredBy}
            color="text-cyan-300"
          />

          <InfoCard
            title="Content Type"
            value={result.contentType}
          />

          <InfoCard
            title="Cache Control"
            value={result.cacheControl}
            color="text-yellow-300"
          />

          <InfoCard
            title="Content Length"
            value={result.contentLength}
          />

          <InfoCard
            title="Response Time"
            value={`${result.responseTime} ms`}
            color="text-cyan-300"
          />

          <InfoCard
            title="Security Score"
            value={`${result.securityScore}/100`}
            color={
              result.securityScore >= 90
                ? "text-green-400"
                : result.securityScore >= 70
                ? "text-yellow-400"
                : "text-red-400"
            }
          />

        </div>

      </div>

      {/* ================= CLICKJACKING ================= */}
            {/* ================= SSL CERTIFICATE ================= */}

      <div className="rounded-2xl border border-cyan-500 bg-slate-900 p-8">

        <h2 className="mb-6 text-3xl font-bold text-cyan-400">
          SSL Certificate Analysis
        </h2>


        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">


          <InfoCard
            title="SSL Status"
            value={
              result.ssl.valid
                ? "Valid ✅"
                : "Invalid ❌"
            }
            color={
              result.ssl.valid
                ? "text-green-400"
                : "text-red-400"
            }
          />



          <InfoCard
            title="Issuer"
            value={result.ssl.issuer}
            color="text-cyan-300"
          />



          <InfoCard
            title="Protocol"
            value={result.ssl.protocol}
            color="text-green-400"
          />



          <InfoCard
            title="Valid From"
            value={
              result.ssl.validFrom
                ? new Date(result.ssl.validFrom)
                    .toLocaleDateString()
                : "N/A"
            }
          />



          <InfoCard
            title="Valid Until"
            value={
              result.ssl.validTo
                ? new Date(result.ssl.validTo)
                    .toLocaleDateString()
                : "N/A"
            }
          />



          <InfoCard
            title="Days Remaining"
            value={`${result.ssl.daysRemaining} days`}
            color={
              result.ssl.daysRemaining > 30
                ? "text-green-400"
                : "text-red-400"
            }
          />


        </div>


      </div>

      <div className="rounded-2xl border border-cyan-500 bg-slate-900 p-8">

        <h2 className="mb-6 text-3xl font-bold text-cyan-400">
          Clickjacking Protection
        </h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">

          <InfoCard
            title="Status"
            value={
              result.clickjacking.protected
                ? "Protected"
                : "Potentially Vulnerable"
            }
            color={
              result.clickjacking.protected
                ? "text-green-400"
                : "text-red-400"
            }
          />

          <InfoCard
            title="Severity"
            value={result.clickjacking.severity}
            color={
              result.clickjacking.severity === "None"
                ? "text-green-400"
                : "text-yellow-400"
            }
          />

          <InfoCard
            title="Assessment"
            value={result.clickjacking.reason}
          />

        </div>

      </div>

      {/* ================= SECURITY HEADERS ================= */}

      <div className="rounded-2xl border border-cyan-500 bg-slate-900 p-8">

        <h2 className="mb-6 text-3xl font-bold text-cyan-400">
          Security Headers Analysis
        </h2>

        <div className="space-y-4">

          {securityHeaders.map((header) => (

            <div
              key={header.title}
              className="flex items-center justify-between rounded-xl bg-slate-800 p-4"
            >

              <span className="font-medium">
                {header.title}
              </span>

              {header.value ? (
                <span className="font-bold text-green-400">
                  ✅ Present
                </span>
              ) : (
                <span className="font-bold text-red-400">
                  ❌ Missing
                </span>
              )}

            </div>

          ))}

        </div>

      </div>
            {/* ================= COOKIE ANALYSIS ================= */}

      <div className="rounded-2xl border border-cyan-500 bg-slate-900 p-8">

        <h2 className="mb-6 text-3xl font-bold text-cyan-400">
          Cookie Analysis
        </h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

          <InfoCard
            title="Cookies Present"
            value={result.cookieAnalysis.present ? "Yes" : "No"}
            color={result.cookieAnalysis.present ? "text-green-400" : "text-red-400"}
          />

          <InfoCard
            title="Secure Flag"
            value={result.cookieAnalysis.secure ? "Enabled" : "Missing"}
            color={result.cookieAnalysis.secure ? "text-green-400" : "text-red-400"}
          />

          <InfoCard
            title="HttpOnly"
            value={result.cookieAnalysis.httpOnly ? "Enabled" : "Missing"}
            color={result.cookieAnalysis.httpOnly ? "text-green-400" : "text-red-400"}
          />

          <InfoCard
            title="SameSite"
            value={result.cookieAnalysis.sameSite}
            color="text-cyan-300"
          />

        </div>

      </div>

      {/* ================= CORS ANALYSIS ================= */}

      <div className="rounded-2xl border border-cyan-500 bg-slate-900 p-8">

        <h2 className="mb-6 text-3xl font-bold text-cyan-400">
          CORS Analysis
        </h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

          <InfoCard
            title="Allow Origin"
            value={result.cors.origin || "Not Set"}
          />

          <InfoCard
            title="Credentials"
            value={result.cors.credentials || "Not Set"}
          />

          <InfoCard
            title="Allowed Methods"
            value={result.cors.methods || "Unknown"}
          />

          <InfoCard
            title="Risk Level"
            value={result.cors.risk}
            color={
              result.cors.risk === "High"
                ? "text-red-400"
                : result.cors.risk === "Medium"
                ? "text-yellow-400"
                : "text-green-400"
            }
          />

        </div>

      </div>

      {/* ================= ROBOTS.TXT ================= */}

      <div className="rounded-2xl border border-cyan-500 bg-slate-900 p-8">

        <h2 className="mb-6 text-3xl font-bold text-cyan-400">
          Robots.txt Analysis
        </h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">

          <InfoCard
            title="Status"
            value={result.robots.found ? "Found" : "Not Found"}
            color={result.robots.found ? "text-green-400" : "text-red-400"}
          />

          <InfoCard
            title="File Size"
            value={`${result.robots.size} bytes`}
          />

          <InfoCard
            title="Disallow Rules"
            value={result.robots.disallowCount}
          />

          <InfoCard
            title="Sitemap"
            value={result.robots.sitemap ? "Present" : "Not Found"}
            color={result.robots.sitemap ? "text-green-400" : "text-red-400"}
          />

          <InfoCard
            title="Robots URL"
            value={result.robots.url || "N/A"}
            color="text-cyan-300"
          />

        </div>

      </div>

      {/* ================= RECOMMENDATIONS ================= */}

<div className="rounded-2xl border border-cyan-500 bg-slate-900 p-8">

  <h2 className="mb-6 text-3xl font-bold text-cyan-400">
    Security Recommendations
  </h2>


  <div className="space-y-3">


    {/* Clickjacking Recommendation */}

    {!result.clickjacking.protected && (

      <div className="rounded-xl border border-red-500 bg-red-900/20 p-4">

        Add <strong>X-Frame-Options</strong> or a CSP

        <strong> frame-ancestors </strong>

        directive to reduce clickjacking risk.

      </div>

    )}



    {/* Missing Security Headers */}

    {result.missingHeaders.map((header:string)=>(

      <div
        key={header}
        className="rounded-xl border border-yellow-500 bg-yellow-900/10 p-4"
      >

        Configure the

        <strong> {header} </strong>

        security header.

      </div>

    ))}





    {/* Cookie Security */}

    {!result.cookieAnalysis.secure && (

      <div className="rounded-xl border border-orange-500 bg-orange-900/20 p-4">

        Enable the

        <strong> Secure </strong>

        flag on cookies to prevent transmission over insecure connections.

      </div>

    )}





    {!result.cookieAnalysis.httpOnly && (

      <div className="rounded-xl border border-orange-500 bg-orange-900/20 p-4">

        Enable the

        <strong> HttpOnly </strong>

        cookie flag to reduce XSS cookie theft risk.

      </div>

    )}





    {/* CORS Recommendation */}

    {result.cors.risk === "High" && (

      <div className="rounded-xl border border-red-500 bg-red-900/20 p-4">

        Avoid using wildcard CORS:

        <strong> Access-Control-Allow-Origin: *</strong>

      </div>

    )}






    {/* Port Risk Recommendation */}

    {result.ports?.map((port:any)=>(


      port.risk === "High" && (

        <div
          key={port.port}
          className="rounded-xl border border-red-500 bg-red-900/20 p-4"
        >

          Close unnecessary high-risk port:

          <strong>
            {" "}
            {port.port} ({port.service})
          </strong>


        </div>

      )


    ))}





        {/* No Issues */}

    {
      result.clickjacking.protected &&
      result.missingHeaders.length === 0 &&
      result.cors.risk !== "High" &&
      result.ports?.every(
        (p:any) => p.risk !== "High"
      ) && (

        <div className="rounded-xl bg-green-900/20 p-5 text-green-400">

          Excellent! No major security issues detected.

        </div>

      )
    }


  </div>

</div>


    </div>

  );

}