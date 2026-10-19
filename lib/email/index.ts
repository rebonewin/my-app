import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transactional email.
 *
 * Providers are tried in this order:
 *   1. Resend HTTP API   (RESEND_API_KEY)
 *   2. SMTP              (SMTP_HOST / SMTP_USER / SMTP_PASSWORD)
 *
 * When neither is configured, `isEmailConfigured()` returns false and callers
 * surface a "not configured" state instead of silently dropping mail. Nothing
 * is ever faked: an unconfigured platform tells the user it cannot send.
 */

const APP_NAME = "1Security";

let transporter: Transporter | null = null;
let transporterKey = "";

export function isEmailConfigured(): boolean {
  if (process.env.RESEND_API_KEY) return true;
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD,
  );
}

/** SMS OTP is delivered through Twilio; without all three values it is off. */
export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER,
  );
}

export function emailFrom(): string {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    `${APP_NAME} <noreply@localhost>`
  );
}

function getTransporter(): Transporter {
  const key = [
    process.env.SMTP_HOST,
    process.env.SMTP_PORT,
    process.env.SMTP_USER,
  ].join("|");

  if (transporter && transporterKey === key) return transporter;

  const port = Number(process.env.SMTP_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Supabase/Vercel egress can be slow on cold start.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  transporterKey = key;
  return transporter;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      ok: false,
      error: `Resend ${response.status}: ${detail.slice(0, 300)}`,
    };
  }

  const data = (await response.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: data.id };
}

async function sendViaSmtp(input: SendEmailInput): Promise<SendEmailResult> {
  const info = await getTransporter().sendMail({
    from: emailFrom(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });
  return { ok: true, id: info.messageId };
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      skipped: true,
      error:
        "Email is not configured. Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASSWORD.",
    };
  }

  try {
    if (process.env.RESEND_API_KEY) return await sendViaResend(input);
    return await sendViaSmtp(input);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown email error",
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Templates                                 */
/* -------------------------------------------------------------------------- */

const BRAND = {
  bg: "#050816",
  panel: "#0b1220",
  border: "#1e293b",
  accent: "#22d3ee",
  accentSoft: "#0891b2",
  text: "#e2e8f0",
  muted: "#94a3b8",
  danger: "#f87171",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(options: {
  title: string;
  preheader: string;
  body: string;
  footer?: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:ui-sans-serif,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;border-bottom:1px solid ${BRAND.border};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${BRAND.accent},#3b82f6);text-align:center;vertical-align:middle;font-weight:800;color:#04121a;font-size:18px;">1</td>
                    <td style="padding-left:12px;color:#fff;font-size:17px;font-weight:700;letter-spacing:0.4px;">1Security</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;color:#fff;font-size:22px;line-height:1.3;font-weight:700;">${escapeHtml(options.title)}</h1>
                <div style="color:${BRAND.text};font-size:15px;line-height:1.65;">${options.body}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.border};color:${BRAND.muted};font-size:12px;line-height:1.6;">
                ${options.footer ?? "You are receiving this because of activity on your 1Security account."}
                <br />
                <span style="color:#64748b;">1Security · Enterprise Security Platform</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;">
    <tr>
      <td style="border-radius:10px;background:linear-gradient(135deg,${BRAND.accent},${BRAND.accentSoft});">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;color:#04121a;font-weight:700;font-size:14px;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

function fallbackLink(href: string): string {
  return `<p style="margin:22px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.6;word-break:break-all;">
    If the button does not work, copy this link into your browser:<br />
    <a href="${escapeHtml(href)}" style="color:${BRAND.accent};">${escapeHtml(href)}</a>
  </p>`;
}

function otpBlock(otp: string): string {
  return `<div style="margin:26px 0;padding:20px;border:1px solid ${BRAND.border};border-radius:12px;background:#0f172a;text-align:center;">
    <div style="color:${BRAND.muted};font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Verification code</div>
    <div style="color:#fff;font-size:34px;font-weight:800;letter-spacing:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(otp)}</div>
    <div style="color:${BRAND.muted};font-size:12px;margin-top:10px;">Expires in 5 minutes</div>
  </div>`;
}

export function verificationEmail(name: string, url: string): SendEmailInput["html"] {
  return layout({
    title: "Verify your email address",
    preheader: "Confirm your email to activate your 1Security account.",
    body: `<p style="margin:0 0 14px;">Hi ${escapeHtml(name || "there")},</p>
      <p style="margin:0;">Confirm this email address to finish setting up your 1Security account.</p>
      ${button(url, "Verify email address")}
      ${fallbackLink(url)}
      <p style="margin:22px 0 0;color:${BRAND.muted};font-size:12px;">This link expires in 1 hour. If you did not create an account, ignore this email.</p>`,
  });
}

export function magicLinkEmail(url: string, host: string): SendEmailInput["html"] {
  return layout({
    title: "Your sign-in link",
    preheader: "Use this single-use link to sign in to 1Security.",
    body: `<p style="margin:0 0 14px;">Someone requested a passwordless sign-in to 1Security${host ? ` from <strong style="color:#fff;">${escapeHtml(host)}</strong>` : ""}.</p>
      ${button(url, "Sign in to 1Security")}
      ${fallbackLink(url)}
      <p style="margin:22px 0 0;color:${BRAND.muted};font-size:12px;">This link is single-use and expires in 5 minutes. If this wasn't you, no action is needed — your account is safe.</p>`,
  });
}

export function resetPasswordEmail(name: string, url: string): SendEmailInput["html"] {
  return layout({
    title: "Reset your password",
    preheader: "Choose a new password for your 1Security account.",
    body: `<p style="margin:0 0 14px;">Hi ${escapeHtml(name || "there")},</p>
      <p style="margin:0;">A password reset was requested for your account. Choose a new password below.</p>
      ${button(url, "Reset password")}
      ${fallbackLink(url)}
      <p style="margin:22px 0 0;color:${BRAND.muted};font-size:12px;">This link expires in 1 hour. If you didn't request it, ignore this email — your password will not change.</p>`,
  });
}

export function otpEmail(name: string, otp: string, purpose: string): SendEmailInput["html"] {
  return layout({
    title: "Your one-time code",
    preheader: `Your 1Security ${purpose} code.`,
    body: `<p style="margin:0 0 14px;">Hi ${escapeHtml(name || "there")},</p>
      <p style="margin:0;">Use the code below to complete your ${escapeHtml(purpose)}.</p>
      ${otpBlock(otp)}
      <p style="margin:0;color:${BRAND.muted};font-size:12px;">Never share this code. 1Security staff will never ask for it.</p>`,
  });
}

export function invitationEmail(options: {
  inviterName: string;
  organizationName: string;
  role: string;
  url: string;
}): SendEmailInput["html"] {
  return layout({
    title: `Join ${options.organizationName}`,
    preheader: `${options.inviterName} invited you to ${options.organizationName} on 1Security.`,
    body: `<p style="margin:0 0 14px;">${escapeHtml(options.inviterName)} invited you to join <strong style="color:#fff;">${escapeHtml(options.organizationName)}</strong> as <strong style="color:${BRAND.accent};">${escapeHtml(options.role)}</strong>.</p>
      <p style="margin:0;">Accept the invitation to access the organization's security workspace.</p>
      ${button(options.url, "Accept invitation")}
      ${fallbackLink(options.url)}
      <p style="margin:22px 0 0;color:${BRAND.muted};font-size:12px;">This invitation expires in 7 days.</p>`,
  });
}

export function securityAlertEmail(options: {
  title: string;
  description: string;
  severity: string;
  ip?: string | null;
  location?: string | null;
  time: string;
  url: string;
}): SendEmailInput["html"] {
  const isCritical = options.severity === "critical" || options.severity === "high";
  return layout({
    title: options.title,
    preheader: options.description,
    body: `<p style="margin:0 0 16px;color:${isCritical ? BRAND.danger : BRAND.text};">${escapeHtml(options.description)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.border};border-radius:12px;background:#0f172a;">
        <tr><td style="padding:14px 16px;color:${BRAND.muted};font-size:12px;width:38%;">Severity</td><td style="padding:14px 16px;color:#fff;font-size:13px;font-weight:600;text-transform:uppercase;">${escapeHtml(options.severity)}</td></tr>
        <tr><td style="padding:14px 16px;color:${BRAND.muted};font-size:12px;border-top:1px solid ${BRAND.border};">Time</td><td style="padding:14px 16px;color:#fff;font-size:13px;border-top:1px solid ${BRAND.border};">${escapeHtml(options.time)}</td></tr>
        ${options.ip ? `<tr><td style="padding:14px 16px;color:${BRAND.muted};font-size:12px;border-top:1px solid ${BRAND.border};">IP address</td><td style="padding:14px 16px;color:#fff;font-size:13px;font-family:ui-monospace,monospace;border-top:1px solid ${BRAND.border};">${escapeHtml(options.ip)}</td></tr>` : ""}
        ${options.location ? `<tr><td style="padding:14px 16px;color:${BRAND.muted};font-size:12px;border-top:1px solid ${BRAND.border};">Location</td><td style="padding:14px 16px;color:#fff;font-size:13px;border-top:1px solid ${BRAND.border};">${escapeHtml(options.location)}</td></tr>` : ""}
      </table>
      ${button(options.url, "Review in security dashboard")}
      <p style="margin:22px 0 0;color:${BRAND.muted};font-size:12px;">If this was you, no action is needed. If not, secure your account immediately.</p>`,
  });
}

export function passwordChangedEmail(name: string, time: string): SendEmailInput["html"] {
  return layout({
    title: "Your password was changed",
    preheader: "Your 1Security password was updated.",
    body: `<p style="margin:0 0 14px;">Hi ${escapeHtml(name || "there")},</p>
      <p style="margin:0;">Your password was changed on ${escapeHtml(time)}. All other sessions were signed out.</p>
      <p style="margin:22px 0 0;color:${BRAND.danger};font-size:13px;">If you did not make this change, reset your password immediately and contact your administrator.</p>`,
  });
}
