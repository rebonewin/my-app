import Link from "next/link";
import { requireAuth } from "@/lib/auth/server";
import { getSecurityOverview } from "@/lib/security/overview";
import { relativeTime, titleCase } from "@/lib/utils";
import { getRole } from "@/lib/rbac/permissions";
import { SecurityScoreRing, ScoreFactor } from "@/components/security/SecurityScore";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  StatTile,
  severityTone,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import {
  ActivityIcon,
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  GlobeIcon,
  KeyIcon,
  MonitorIcon,
  RadarIcon,
  ShieldIcon,
  SmartphoneIcon,
  SparklesIcon,
} from "@/components/ui/icons";

export const instant = false;

export const metadata = {
  title: "Dashboard · 1Security",
};

export default async function DashboardPage() {
  const context = await requireAuth();
  const overview = await getSecurityOverview(context.user.id);
  const role = getRole(context.user.role);

  const firstName = (context.user.name ?? "operator").split(" ")[0];

  const recommendations: Array<{ title: string; body: string; href: string }> = [];
  if (!context.user.twoFactorEnabled) {
    recommendations.push({
      title: "Enable two-factor authentication",
      body: "A stolen password is not enough to reach this account once 2FA is on.",
      href: "/settings/security",
    });
  }
  if (overview.counts.passkeys === 0) {
    recommendations.push({
      title: "Register a passkey",
      body: "Passkeys are phishing-resistant and replace the password entirely.",
      href: "/settings/security",
    });
  }
  if (!context.user.emailVerified) {
    recommendations.push({
      title: "Verify your email",
      body: "Required for password recovery and security notifications.",
      href: `/verify-email?email=${encodeURIComponent(context.user.email)}`,
    });
  }
  if (overview.counts.activeSessions > 5) {
    recommendations.push({
      title: "Review active sessions",
      body: `${overview.counts.activeSessions} sessions are signed in. Close the ones you do not recognise.`,
      href: "/sessions",
    });
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-cyan-500/[0.08] via-white/[0.02] to-violet-500/[0.06] p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">
                <ShieldIcon size={11} />
                {role.name}
              </Badge>
              {context.user.emailVerified ? (
                <Badge tone="green">
                  <CheckIcon size={11} />
                  Verified
                </Badge>
              ) : (
                <Badge tone="amber">Email unverified</Badge>
              )}
              {context.user.twoFactorEnabled ? (
                <Badge tone="green">2FA enabled</Badge>
              ) : (
                <Badge tone="amber">2FA disabled</Badge>
              )}
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Welcome back, {firstName}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Your account is scored on live control coverage, not a static
              checklist. Every score change traces to evidence below.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <SecurityScoreRing
              score={overview.score.score}
              grade={overview.score.grade}
            />
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Open security events"
          value={overview.counts.openEvents}
          hint={`${overview.counts.eventsLast30Days} in the last 30 days`}
          tone={overview.counts.openEvents > 0 ? "red" : "green"}
          icon={<AlertIcon size={16} />}
        />
        <StatTile
          label="Active sessions"
          value={overview.counts.activeSessions}
          hint={`${overview.counts.trustedDevices} trusted devices`}
          tone="cyan"
          icon={<MonitorIcon size={16} />}
        />
        <StatTile
          label="Scans run"
          value={overview.counts.scans}
          hint={`${overview.counts.highRiskScans} high or critical risk`}
          tone={overview.counts.highRiskScans > 0 ? "amber" : "green"}
          icon={<RadarIcon size={16} />}
        />
        <StatTile
          label="Passkeys"
          value={overview.counts.passkeys}
          hint={
            overview.counts.passkeys > 0
              ? "Phishing-resistant sign-in available"
              : "No passkey registered yet"
          }
          tone={overview.counts.passkeys > 0 ? "green" : "amber"}
          icon={<KeyIcon size={16} />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Score breakdown */}
        <Card className="xl:col-span-1">
          <CardHeader
            title="Security posture"
            description="Transparent scoring: every point maps to a control"
            action={
              <Link
                href="/settings/security"
                className="text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                Improve
              </Link>
            }
          />
          <CardBody className="space-y-4">
            {overview.score.factors.map((factor) => (
              <ScoreFactor key={factor.label} {...factor} />
            ))}
          </CardBody>
        </Card>

        {/* Recommendations */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recommended next actions"
            description="Derived from the gaps in your current posture"
            action={
              <Badge tone={recommendations.length ? "amber" : "green"}>
                {recommendations.length
                  ? `${recommendations.length} open`
                  : "All clear"}
              </Badge>
            }
          />
          <CardBody className="p-0">
            {recommendations.length === 0 ? (
              <EmptyState
                icon={<SparklesIcon size={20} />}
                title="Every core control is in place"
                description="Keep monitoring the security page for new events and review sessions periodically."
                action={
                  <ButtonLink href="/security" size="sm" variant="secondary">
                    Open security centre
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {recommendations.map((item) => (
                  <li key={item.title}>
                    <Link
                      href={item.href}
                      className="group flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.03]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                        <ShieldIcon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-white">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {item.body}
                        </span>
                      </span>
                      <ArrowRightIcon
                        size={16}
                        className="shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-400"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Recent events */}
        <Card className="xl:col-span-1">
          <CardHeader
            title="Recent security events"
            description="Threat engine output"
            action={
              <Link
                href="/security"
                className="text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                View all
              </Link>
            }
          />
          <CardBody className="p-0">
            {overview.recentEvents.length === 0 ? (
              <EmptyState
                icon={<ShieldIcon size={20} />}
                title="No security events"
                description="Risk-scored sign-ins, impossible travel and brute-force detection all report here."
              />
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {overview.recentEvents.map((event) => (
                  <li key={event.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium text-white">
                        {event.title}
                      </p>
                      <Badge tone={severityTone(event.severity)}>
                        {event.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                      {event.description}
                    </p>
                    <p className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-600">
                      <span>{titleCase(event.type)}</span>
                      <span>·</span>
                      <span>{relativeTime(event.createdAt)}</span>
                      {event.country ? (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <GlobeIcon size={10} />
                            {event.country}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Recent scans */}
        <Card className="xl:col-span-1">
          <CardHeader
            title="Recent scans"
            description="Persisted assessment history"
            action={
              <Link
                href="/reports"
                className="text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                Reports
              </Link>
            }
          />
          <CardBody className="p-0">
            {overview.recentScans.length === 0 ? (
              <EmptyState
                icon={<RadarIcon size={20} />}
                title="No scans yet"
                description="Run your first assessment to start building history."
                action={
                  <ButtonLink href="/scanner" size="sm">
                    Open scanner
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {overview.recentScans.map((item) => (
                  <li key={item.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-mono text-xs text-slate-200">
                        {item.target}
                      </p>
                      <Badge tone={severityTone(item.riskLevel ?? "unknown")}>
                        {item.riskLevel ?? "unknown"}
                      </Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-[10px] text-slate-600">
                      <span>{item.findingCount} findings</span>
                      <span>·</span>
                      <span>score {item.riskScore}</span>
                      <span>·</span>
                      <span>{relativeTime(item.createdAt)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Login activity */}
        <Card className="xl:col-span-1">
          <CardHeader
            title="Sign-in activity"
            description="Latest authentication attempts"
            action={
              <Link
                href="/activity"
                className="text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                Full history
              </Link>
            }
          />
          <CardBody className="p-0">
            {overview.recentLogins.length === 0 ? (
              <EmptyState
                icon={<ActivityIcon size={20} />}
                title="No sign-in history"
                description="Authentication attempts appear here with device and location."
              />
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {overview.recentLogins.map((login) => (
                  <li
                    key={login.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        login.status === "success"
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                          : "border-red-400/20 bg-red-400/10 text-red-300"
                      }`}
                    >
                      {login.status === "success" ? (
                        <CheckIcon size={14} />
                      ) : (
                        <AlertIcon size={14} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-white">
                        {login.browser ?? "Unknown browser"}
                        {login.os ? ` · ${login.os}` : ""}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {[login.city, login.country].filter(Boolean).join(", ") ||
                          login.ipAddress ||
                          "Unknown location"}
                        {" · "}
                        {relativeTime(login.createdAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-600">
                      {login.method}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Trust strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: <ShieldIcon size={16} />,
            title: "Scrypt password hashing",
            body: "Credentials never leave the auth layer in plaintext.",
          },
          {
            icon: <SmartphoneIcon size={16} />,
            title: "Device-level revocation",
            body: "Kill a single session or every session in one action.",
          },
          {
            icon: <GlobeIcon size={16} />,
            title: "Geo-aware threat detection",
            body: "Impossible travel, Tor exits and spraying are flagged live.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5"
          >
            <span className="mt-0.5 text-cyan-400">{item.icon}</span>
            <div>
              <p className="text-xs font-medium text-white">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
