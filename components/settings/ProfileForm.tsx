"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { CheckIcon, MailIcon, ShieldIcon } from "@/components/ui/icons";
import { formatDate, initials } from "@/lib/utils";

export interface ProfileUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  roleLabel: string;
  createdAt: string;
  lastLoginAt: string | null;
  lastLoginMethod: string | null;
  twoFactorEnabled: boolean;
}

export function ProfileForm({
  user,
  emailConfigured,
  emailChangeToken = null,
}: {
  user: ProfileUser;
  emailConfigured: boolean;
  emailChangeToken?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [image, setImage] = useState(user.image ?? "");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nextEmail, setNextEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(
    Boolean(emailChangeToken),
  );
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const confirmedToken = useRef(false);

  // The emailed link lands back here with a one-time token. Consume it exactly
  // once (StrictMode double-invokes effects in development) and strip it from
  // the address bar so a refresh cannot replay it.
  useEffect(() => {
    if (!emailChangeToken || confirmedToken.current) return;
    confirmedToken.current = true;

    void (async () => {
      setConfirmingEmail(true);
      setEmailError(null);

      const response = await fetch("/api/account/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: emailChangeToken }),
      });
      const data = (await response.json().catch(() => null)) as
        | { email?: string; rotatedSessions?: number; error?: string }
        | null;

      setConfirmingEmail(false);

      if (!response.ok) {
        setEmailError(
          data?.error ?? "Could not confirm the new email address.",
        );
      } else {
        setEmailMessage(
          `Email changed to ${data?.email ?? "your new address"}. Verify it from that inbox to finish.`,
        );
        router.refresh();
      }

      window.history.replaceState(null, "", "/settings");
    })();
  }, [emailChangeToken, router]);

  async function requestEmailChange(event: React.FormEvent) {
    event.preventDefault();
    const target = nextEmail.trim().toLowerCase();
    if (!target) return;

    setChangingEmail(true);
    setEmailError(null);
    setEmailMessage(null);

    const response = await fetch("/api/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: target }),
    });
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; email?: string; error?: string }
      | null;

    setChangingEmail(false);

    if (!response.ok) {
      setEmailError(data?.error ?? "Could not start the email change.");
      return;
    }

    setNextEmail("");
    setEmailMessage(
      `Confirmation sent to ${data?.email ?? target}. Open the link from that inbox to finish.`,
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await authClient.updateUser({
      name: name.trim(),
      image: image.trim() || null,
    });

    setSaving(false);

    if (updateError) {
      setError(updateError.message ?? "Could not update your profile.");
      return;
    }

    setMessage("Profile updated.");
    router.refresh();
  }

  async function resendVerification() {
    setSending(true);
    setError(null);
    setMessage(null);

    const { error: sendError } = await authClient.sendVerificationEmail({
      email: user.email,
      callbackURL: "/settings",
    });

    setSending(false);

    if (sendError) {
      setError(sendError.message ?? "Could not send the verification email.");
      return;
    }

    setMessage("Verification email sent. Check your inbox.");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Profile"
            description="Displayed on audit entries, invitations and reports."
          />
          <CardBody>
            <form onSubmit={save} className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 text-lg font-semibold text-cyan-200">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(name || user.email)
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {name || "Unnamed operator"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
              </div>

              <Field label="Full name" htmlFor="profile-name" required>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  required
                />
              </Field>

              <Field
                label="Avatar URL"
                htmlFor="profile-image"
                hint="Optional. Use an https image URL."
              >
                <Input
                  id="profile-image"
                  value={image}
                  onChange={(event) => setImage(event.target.value)}
                  placeholder="https://…"
                  type="url"
                />
              </Field>

              {message ? <Alert tone="success">{message}</Alert> : null}
              {error ? <Alert tone="error">{error}</Alert> : null}

              <div className="flex justify-end">
                <Button type="submit" loading={saving}>
                  Save changes
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Email address"
            description="Changing your email requires re-verification."
            action={
              <Badge tone={user.emailVerified ? "green" : "amber"}>
                {user.emailVerified ? "Verified" : "Unverified"}
              </Badge>
            }
          />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-200">{user.email}</p>
                <p className="text-[11px] text-slate-500">
                  {user.emailVerified
                    ? "Ownership confirmed."
                    : "Verify to unlock password recovery and alerts."}
                </p>
              </div>
              {!user.emailVerified ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={sending}
                  disabled={!emailConfigured}
                  onClick={resendVerification}
                  title={
                    emailConfigured
                      ? undefined
                      : "Configure SMTP to enable outbound email."
                  }
                >
                  <MailIcon size={13} />
                  Resend
                </Button>
              ) : null}
            </div>
            {!emailConfigured ? (
              <p className="text-[11px] text-amber-300/80">
                Outbound email is not configured. Set the SMTP environment
                variables to enable verification, email changes and password
                recovery.
              </p>
            ) : null}

            <form
              onSubmit={requestEmailChange}
              className="space-y-3 border-t border-white/[0.06] pt-3"
            >
              <Field
                label="Change email"
                htmlFor="profile-email"
                hint="We email a confirmation link to the new address. Other devices are signed out once it is confirmed."
              >
                <Input
                  id="profile-email"
                  type="email"
                  autoComplete="email"
                  placeholder="new@company.com"
                  value={nextEmail}
                  onChange={(event) => setNextEmail(event.target.value)}
                  disabled={!emailConfigured || changingEmail}
                  required
                />
              </Field>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  loading={changingEmail}
                  disabled={!emailConfigured}
                >
                  <MailIcon size={13} />
                  Send confirmation
                </Button>
              </div>
            </form>

            {confirmingEmail ? (
              <Alert tone="info">Confirming your new email address…</Alert>
            ) : null}
            {emailMessage ? (
              <Alert tone="success">{emailMessage}</Alert>
            ) : null}
            {emailError ? <Alert tone="error">{emailError}</Alert> : null}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Account" />
          <CardBody className="space-y-3 text-xs">
            <Row label="Role" value={user.roleLabel} />
            <Row label="Member since" value={formatDate(user.createdAt)} />
            <Row
              label="Last sign-in"
              value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
            />
            <Row
              label="Method"
              value={user.lastLoginMethod ?? "Not recorded"}
            />
            <div className="border-t border-white/[0.06] pt-3">
              <Link
                href="/settings/security"
                className="flex items-center justify-between rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] px-3 py-2.5 text-cyan-200 transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.07]"
              >
                <span className="flex items-center gap-2">
                  <ShieldIcon size={14} />
                  Security settings
                </span>
                <span className="text-cyan-400">→</span>
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Account posture" />
          <CardBody className="space-y-2.5">
            <PostureRow
              ok={user.emailVerified}
              label="Email verified"
              detail={user.emailVerified ? "Confirmed" : "Unverified"}
            />
            <PostureRow
              ok={user.twoFactorEnabled}
              label="Two-factor auth"
              detail={user.twoFactorEnabled ? "Enabled" : "Not enabled"}
            />
            <PostureRow ok label="Session isolation" detail="HttpOnly cookies" />
            <PostureRow ok label="Audit trail" detail="Every action logged" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="truncate text-right text-slate-300">{value}</span>
    </div>
  );
}

function PostureRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={
          ok
            ? "flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"
            : "flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/15 text-amber-300"
        }
      >
        <CheckIcon size={11} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-slate-300">{label}</p>
        <p className="text-[10px] text-slate-600">{detail}</p>
      </div>
    </div>
  );
}
