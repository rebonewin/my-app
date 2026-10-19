"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, PasswordInput } from "@/components/ui/input";
import {
  CopyIcon,
  FingerprintIcon,
  KeyIcon,
  LockIcon,
  MailIcon,
  MonitorIcon,
  PhoneIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { formatDate } from "@/lib/utils";

export interface PasskeyRow {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  createdAt: string | null;
}

export function SecuritySettings({
  twoFactorEnabled,
  backupCodesRemaining,
  passkeys,
  trustedDevices,
  emailConfigured,
  smsConfigured,
}: {
  twoFactorEnabled: boolean;
  backupCodesRemaining: number;
  passkeys: PasskeyRow[];
  trustedDevices: number;
  emailConfigured: boolean;
  smsConfigured: boolean;
}) {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <PasswordCard />
      <TwoFactorCard
        enabled={twoFactorEnabled}
        backupCodesRemaining={backupCodesRemaining}
        emailConfigured={emailConfigured}
        smsConfigured={smsConfigured}
        onChanged={() => router.refresh()}
      />
      <PasskeysCard passkeys={passkeys} onChanged={() => router.refresh()} />
      <TrustedDevicesCard count={trustedDevices} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Password                                  */
/* -------------------------------------------------------------------------- */

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword.length < 12) {
      setError("Use at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    setSaving(true);
    const { error: changeError } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions,
    });
    setSaving(false);

    if (changeError) {
      setError(changeError.message ?? "Could not change your password.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage(
      revokeOtherSessions
        ? "Password changed. All other sessions were revoked."
        : "Password changed.",
    );
  }

  return (
    <Card>
      <CardHeader
        title="Password"
        description="Minimum 12 characters. Every change is written to the audit log."
        action={<Badge tone="neutral">Argon2id hashed</Badge>}
      />
      <CardBody>
        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Current password" htmlFor="current-password" required>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="New password" htmlFor="new-password" required>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm-password" required>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
          </div>
          <label className="flex items-center gap-2.5 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={revokeOtherSessions}
              onChange={(event) => setRevokeOtherSessions(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-900 accent-cyan-400"
            />
            Sign out every other device after changing
          </label>

          {message ? <Alert tone="success">{message}</Alert> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              <LockIcon size={14} />
              Update password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Two-factor                                  */
/* -------------------------------------------------------------------------- */

function TwoFactorCard({
  enabled,
  backupCodesRemaining,
  emailConfigured,
  smsConfigured,
  onChanged,
}: {
  enabled: boolean;
  backupCodesRemaining: number;
  emailConfigured: boolean;
  smsConfigured: boolean;
  onChanged: () => void;
}) {
  const [password, setPassword] = useState("");
  const [starting, setStarting] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function begin(event: React.FormEvent) {
    event.preventDefault();
    setStarting(true);
    setError(null);
    setMessage(null);

    const { data, error: enableError } = await authClient.twoFactor.enable({
      password,
    });

    setStarting(false);

    if (enableError) {
      setError(enableError.message ?? "Could not start two-factor setup.");
      return;
    }

    const payload = data as { totpURI?: string; backupCodes?: string[] } | null;
    if (payload?.totpURI) {
      setUri(payload.totpURI);
      try {
        setSecret(new URL(payload.totpURI).searchParams.get("secret"));
      } catch {
        setSecret(null);
      }
    }
    if (payload?.backupCodes) setCodes(payload.backupCodes);
    setPassword("");
  }

  async function activate(event: React.FormEvent) {
    event.preventDefault();
    setVerifying(true);
    setError(null);

    const { error: verifyError } = await authClient.twoFactor.verifyTotp({
      code: code.trim(),
    });

    setVerifying(false);

    if (verifyError) {
      setError(verifyError.message ?? "That code was not accepted.");
      return;
    }

    setMessage("Two-factor authentication is active.");
    setUri(null);
    setSecret(null);
    setCode("");
    onChanged();
  }

  async function disable(event: React.FormEvent) {
    event.preventDefault();
    if (!confirm("Disable two-factor authentication? This weakens your account.")) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);

    const { error: disableError } = await authClient.twoFactor.disable({
      password,
    });

    setBusy(false);

    if (disableError) {
      setError(disableError.message ?? "Could not disable two-factor.");
      return;
    }

    setPassword("");
    setMessage("Two-factor authentication disabled.");
    onChanged();
  }

  async function regenerate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const { data, error: generateError } =
      await authClient.twoFactor.generateBackupCodes({ password });

    setBusy(false);

    if (generateError) {
      setError(generateError.message ?? "Could not generate backup codes.");
      return;
    }

    const payload = data as { backupCodes?: string[] } | null;
    if (payload?.backupCodes) {
      setCodes(payload.backupCodes);
      setMessage("New recovery codes generated. Previous codes are invalid.");
    }
    setPassword("");
    onChanged();
  }

  async function copyCodes() {
    if (!codes?.length) return;
    await navigator.clipboard.writeText(codes.join("\n"));
    setMessage("Recovery codes copied to the clipboard.");
  }

  return (
    <Card>
      <CardHeader
        title="Two-factor authentication"
        description="TOTP authenticator app, email codes, SMS codes and single-use recovery codes."
        action={
          <Badge tone={enabled ? "green" : "amber"}>
            {enabled ? "Enabled" : "Not enabled"}
          </Badge>
        }
      />
      <CardBody className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Method
            icon={<ShieldCheckIcon size={14} />}
            label="Authenticator"
            state={enabled ? "active" : "available"}
            ok={enabled}
          />
          <Method
            icon={<MailIcon size={14} />}
            label="Email OTP"
            state={emailConfigured ? "available" : "needs SMTP"}
            ok={emailConfigured}
          />
          <Method
            icon={<PhoneIcon size={14} />}
            label="SMS OTP"
            state={smsConfigured ? "available" : "needs Twilio"}
            ok={smsConfigured}
          />
          <Method
            icon={<KeyIcon size={14} />}
            label="Recovery codes"
            state={`${backupCodesRemaining} left`}
            ok={backupCodesRemaining > 0}
          />
        </div>

        {message ? <Alert tone="success">{message}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}

        {!enabled && !uri ? (
          <form onSubmit={begin} className="space-y-3">
            <p className="text-xs text-slate-400">
              Confirm your password to generate a TOTP secret. You will scan it
              with an authenticator app and enter one code to finish.
            </p>
            <Field label="Password" htmlFor="totp-password" required>
              <PasswordInput
                id="totp-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <Button type="submit" loading={starting}>
              <ShieldCheckIcon size={14} />
              Begin setup
            </Button>
          </form>
        ) : null}

        {!enabled && uri ? (
          <div className="space-y-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
            <p className="text-xs font-medium text-cyan-100">
              Add this account to your authenticator
            </p>
            <p className="break-all rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[10px] text-slate-300">
              {uri}
            </p>
            {secret ? (
              <p className="text-[11px] text-slate-400">
                Manual entry key:{" "}
                <span className="select-all font-mono text-cyan-200">{secret}</span>
              </p>
            ) : null}
            {codes?.length ? (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">
                    Recovery codes (shown once)
                  </p>
                  <button
                    type="button"
                    onClick={copyCodes}
                    className="flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-200"
                  >
                    <CopyIcon size={11} /> Copy all
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-white/10 bg-black/40 p-2.5 sm:grid-cols-3">
                  {codes.map((entry) => (
                    <code
                      key={entry}
                      className="select-all font-mono text-[10px] text-slate-300"
                    >
                      {entry}
                    </code>
                  ))}
                </div>
              </div>
            ) : null}
            <form onSubmit={activate} className="flex items-end gap-2">
              <Field label="6-digit code" htmlFor="totp-code" required>
                <Input
                  id="totp-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="w-32 font-mono tracking-[0.3em]"
                  required
                />
              </Field>
              <Button type="submit" loading={verifying} className="h-11">
                Activate
              </Button>
            </form>
          </div>
        ) : null}

        {enabled ? (
          <div className="space-y-3">
            <form onSubmit={regenerate} className="flex flex-wrap items-end gap-2">
              <Field
                label="Password"
                htmlFor="regen-password"
                hint="Required to issue new recovery codes."
              >
                <PasswordInput
                  id="regen-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="w-56"
                  required
                />
              </Field>
              <Button type="submit" variant="secondary" loading={busy}>
                Regenerate recovery codes
              </Button>
            </form>

            {codes?.length ? (
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">New recovery codes</p>
                  <button
                    type="button"
                    onClick={copyCodes}
                    className="flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-200"
                  >
                    <CopyIcon size={11} /> Copy
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {codes.map((entry) => (
                    <code
                      key={entry}
                      className="select-all font-mono text-[10px] text-slate-300"
                    >
                      {entry}
                    </code>
                  ))}
                </div>
              </div>
            ) : null}

            <form onSubmit={disable} className="flex flex-wrap items-end gap-2">
              <Field label="Password" htmlFor="disable-password" required>
                <PasswordInput
                  id="disable-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="w-56"
                  required
                />
              </Field>
              <Button type="submit" variant="danger" loading={busy}>
                Disable two-factor
              </Button>
            </form>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Method({
  icon,
  label,
  state,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  state: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-slate-300">
        <span className={ok ? "text-emerald-300" : "text-slate-500"}>{icon}</span>
        {label}
      </p>
      <p
        className={
          ok
            ? "mt-0.5 text-[10px] text-emerald-400/80"
            : "mt-0.5 text-[10px] text-slate-500"
        }
      >
        {state}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Passkeys                                  */
/* -------------------------------------------------------------------------- */

function PasskeysCard({
  passkeys,
  onChanged,
}: {
  passkeys: PasskeyRow[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setAdding(true);
    setError(null);
    setMessage(null);

    try {
      const result = await authClient.passkey.addPasskey({
        name: name.trim() || undefined,
      });

      if (result?.error) {
        setError(result.error.message ?? "Passkey registration failed.");
        return;
      }

      setName("");
      setMessage("Passkey registered.");
      onChanged();
    } catch {
      setError(
        "Passkey registration was cancelled or is not supported by this browser.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this passkey? You will lose this sign-in method.")) {
      return;
    }
    setBusyId(id);
    setError(null);

    const { error: deleteError } = await authClient.passkey.deletePasskey({
      id,
    });

    setBusyId(null);

    if (deleteError) {
      setError(deleteError.message ?? "Could not remove the passkey.");
      return;
    }

    setMessage("Passkey removed.");
    onChanged();
  }

  return (
    <Card>
      <CardHeader
        title="Passkeys"
        description="Phishing-resistant WebAuthn credentials bound to this device or your platform keychain."
        action={
          <Badge tone={passkeys.length > 0 ? "green" : "neutral"}>
            {passkeys.length} registered
          </Badge>
        }
      />
      <CardBody className="space-y-4">
        {message ? <Alert tone="success">{message}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}

        {passkeys.length === 0 ? (
          <p className="text-xs text-slate-500">
            No passkeys yet. Register one to sign in without a password.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/[0.06]">
            {passkeys.map((passkey) => (
              <li
                key={passkey.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-cyan-300">
                    <FingerprintIcon size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-200">
                      {passkey.name ?? "Unnamed passkey"}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {passkey.deviceType}
                      {passkey.backedUp ? " · synced" : " · device-bound"}
                      {passkey.createdAt
                        ? ` · added ${formatDate(passkey.createdAt)}`
                        : ""}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busyId === passkey.id}
                  disabled={busyId !== null}
                  onClick={() => remove(passkey.id)}
                  aria-label="Remove passkey"
                >
                  <TrashIcon size={13} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <Field label="Passkey name" htmlFor="passkey-name">
            <Input
              id="passkey-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="MacBook Touch ID"
              maxLength={60}
              className="w-56"
            />
          </Field>
          <Button type="submit" loading={adding}>
            <FingerprintIcon size={14} />
            Register passkey
          </Button>
        </form>
        <p className="text-[10px] text-slate-600">
          Passkeys are bound to the domain they are registered on. Register again
          if the production domain changes.
        </p>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Trusted devices                               */
/* -------------------------------------------------------------------------- */

function TrustedDevicesCard({ count }: { count: number }) {
  return (
    <Card>
      <CardHeader
        title="Devices and sessions"
        description="Trusted devices skip the new-device challenge for 30 days."
        action={<Badge tone="cyan">{count} trusted</Badge>}
      />
      <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <MonitorIcon size={14} className="text-slate-500" />
          Review every device that has authenticated to this account.
        </p>
        <div className="flex gap-2">
          <Link
            href="/devices"
            className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
          >
            Devices
          </Link>
          <Link
            href="/sessions"
            className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
          >
            Sessions
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
