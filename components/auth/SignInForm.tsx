"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input, PasswordInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckIcon, FingerprintIcon, MailIcon, ShieldIcon } from "@/components/ui/icons";

export interface ProviderAvailability {
  google: boolean;
  github: boolean;
  microsoft: boolean;
  linkedin: boolean;
  apple: boolean;
  email: boolean;
  sms: boolean;
}

type Method = "password" | "magic" | "otp" | "passkey";

const METHOD_LABELS: Array<{ id: Method; label: string }> = [
  { id: "password", label: "Password" },
  { id: "passkey", label: "Passkey" },
  { id: "magic", label: "Magic link" },
  { id: "otp", label: "Email code" },
];

function ProviderMark({ provider }: { provider: string }) {
  const label: Record<string, string> = {
    google: "Google",
    github: "GitHub",
    microsoft: "Microsoft",
    linkedin: "LinkedIn",
    apple: "Apple",
  };
  return <>{label[provider] ?? provider}</>;
}

export function SignInForm({
  providers,
}: {
  providers: ProviderAvailability;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard";

  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const socialProviders = (
    ["google", "github", "microsoft", "linkedin", "apple"] as const
  ).filter((key) => providers[key]);

  function reset() {
    setError(null);
    setNotice(null);
  }

  async function handlePassword(event: React.FormEvent) {
    event.preventDefault();
    reset();
    setLoading(true);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
      rememberMe: remember,
      callbackURL: next,
    });

    if (signInError) {
      setLoading(false);
      setError(
        signInError.status === 429
          ? "Too many attempts. Wait a minute before trying again."
          : (signInError.message ?? "Sign-in failed. Check your credentials."),
      );
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleMagicLink(event: React.FormEvent) {
    event.preventDefault();
    reset();
    setLoading(true);

    const { error: magicError } = await authClient.signIn.magicLink({
      email,
      callbackURL: next,
    });

    setLoading(false);

    if (magicError) {
      setError(magicError.message ?? "Could not send the sign-in link.");
      return;
    }

    setMagicSent(true);
    setNotice("Check your inbox — the link expires in 5 minutes.");
  }

  async function handleSendOtp(event: React.FormEvent) {
    event.preventDefault();
    reset();
    setLoading(true);

    const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });

    setLoading(false);

    if (otpError) {
      setError(otpError.message ?? "Could not send the code.");
      return;
    }

    setOtpSent(true);
    setNotice("We sent a 6-digit code to your email.");
  }

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    reset();
    setLoading(true);

    const { error: verifyError } = await authClient.signIn.emailOtp({
      email,
      otp,
    });

    if (verifyError) {
      setLoading(false);
      setError(verifyError.message ?? "That code is not valid.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handlePasskey() {
    reset();
    setLoading(true);

    const { error: passkeyError } = await authClient.signIn.passkey();

    if (passkeyError) {
      setLoading(false);
      setError(
        passkeyError.message ??
          "Passkey sign-in was cancelled or no passkey is registered for this device.",
      );
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleSocial(provider: string) {
    reset();
    setLoading(true);
    await authClient.signIn.social({
      provider: provider as "google",
      callbackURL: next,
    });
  }

  const emailConfigured = providers.email;

  return (
    <div className="space-y-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}

      {/* Method switcher */}
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {METHOD_LABELS.filter(
          (item) => item.id !== "passkey" || true,
        ).map((item) => {
          const disabled =
            item.id === "passkey"
              ? false
              : item.id !== "password" && !emailConfigured;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                setMethod(item.id);
                reset();
                setOtpSent(false);
                setMagicSent(false);
              }}
              className={cn(
                "rounded-lg px-2 py-2 text-[11px] font-medium transition",
                method === item.id
                  ? "bg-gradient-to-r from-cyan-400/90 to-blue-500/90 text-slate-950"
                  : "text-slate-400 hover:text-white",
                disabled && "cursor-not-allowed opacity-40 hover:text-slate-400",
              )}
              title={
                disabled
                  ? "Requires a configured email provider (RESEND_API_KEY or SMTP)"
                  : undefined
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {method === "passkey" ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
              <FingerprintIcon size={24} />
            </span>
            <div>
              <p className="text-sm font-medium text-white">
                Sign in with a passkey
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Use your device biometrics or a hardware security key. No
                password is transmitted.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full"
            loading={loading}
            onClick={handlePasskey}
          >
            <FingerprintIcon size={16} />
            Continue with passkey
          </Button>
        </div>
      ) : null}

      {method === "password" ? (
        <form onSubmit={handlePassword} className="space-y-4">
          <Field label="Email address" htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Password" htmlFor="password" required>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <div className="flex items-center justify-between text-xs">
            <label className="flex cursor-pointer items-center gap-2 text-slate-400">
              <span className="relative flex h-4 w-4 items-center justify-center">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="peer h-4 w-4 appearance-none rounded border border-white/20 bg-white/[0.04] checked:border-cyan-400 checked:bg-cyan-400/90"
                />
                <CheckIcon
                  size={11}
                  className="pointer-events-none absolute text-slate-950 opacity-0 peer-checked:opacity-100"
                />
              </span>
              Keep me signed in
            </label>
            <Link
              href="/forgot-password"
              className="text-cyan-400 transition hover:text-cyan-300"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            <ShieldIcon size={16} />
            Sign in securely
          </Button>
        </form>
      ) : null}

      {method === "magic" && !magicSent ? (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <Field
            label="Email address"
            htmlFor="magic-email"
            required
            hint="Passwordless"
          >
            <Input
              id="magic-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            <MailIcon size={16} />
            Email me a sign-in link
          </Button>
        </form>
      ) : null}

      {method === "magic" && magicSent ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-6 text-center">
          <p className="text-sm text-white">Link sent</p>
          <p className="mt-1 text-xs text-slate-400">
            Open the message sent to {email} and follow the link.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => {
              setMagicSent(false);
              reset();
            }}
          >
            Use a different email
          </Button>
        </div>
      ) : null}

      {method === "otp" && !otpSent ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <Field label="Email address" htmlFor="otp-email" required>
            <Input
              id="otp-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Send 6-digit code
          </Button>
        </form>
      ) : null}

      {method === "otp" && otpSent ? (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <Field label="Verification code" htmlFor="otp" required hint={email}>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              placeholder="000000"
              className="text-center font-mono text-lg tracking-[0.5em]"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Verify and sign in
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setOtpSent(false);
              setOtp("");
              reset();
            }}
          >
            Use a different email
          </Button>
        </form>
      ) : null}

      {socialProviders.length > 0 ? (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-white/[0.08]" />
            <span className="text-[10px] uppercase tracking-widest text-slate-500">
              or continue with
            </span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {socialProviders.map((provider) => (
              <Button
                key={provider}
                type="button"
                variant="secondary"
                onClick={() => handleSocial(provider)}
                disabled={loading}
              >
                <ProviderMark provider={provider} />
              </Button>
            ))}
          </div>
        </>
      ) : null}

      <p className="text-center text-xs text-slate-500">
        No account yet?{" "}
        <Link
          href="/sign-up"
          className="text-cyan-400 transition hover:text-cyan-300"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
