"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Mode = "totp" | "otp" | "backup";

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "totp", label: "Authenticator app" },
  { id: "otp", label: "Email code" },
  { id: "backup", label: "Backup code" },
];

export function TwoFactorChallenge() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function sendEmailCode() {
    setError(null);
    setSending(true);
    const { error: sendError } = await authClient.twoFactor.sendOtp();
    setSending(false);
    if (sendError) {
      setError(sendError.message ?? "Could not send the email code.");
      return;
    }
    setNotice("A 6-digit code is on its way to your email.");
    setMode("otp");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const payload =
      mode === "backup"
        ? await authClient.twoFactor.verifyBackupCode({ code })
        : mode === "otp"
          ? await authClient.twoFactor.verifyOtp({ code, trustDevice: trust })
          : await authClient.twoFactor.verifyTotp({ code, trustDevice: trust });

    if (payload.error) {
      setLoading(false);
      setError(payload.error.message ?? "That code was not accepted.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setMode(item.id);
              setCode("");
              setError(null);
            }}
            className={cn(
              "rounded-lg px-2 py-2 text-[11px] font-medium transition",
              mode === item.id
                ? "bg-gradient-to-r from-cyan-400/90 to-blue-500/90 text-slate-950"
                : "text-slate-400 hover:text-white",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label={
            mode === "backup"
              ? "Backup code"
              : mode === "otp"
                ? "Email verification code"
                : "Authenticator code"
          }
          htmlFor="two-factor-code"
          required
          hint={mode === "backup" ? "Single use" : "6 digits"}
        >
          <Input
            id="two-factor-code"
            inputMode={mode === "backup" ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoFocus
            required
            placeholder={mode === "backup" ? "XXXX-XXXX" : "000000"}
            className="text-center font-mono text-lg tracking-[0.4em]"
            value={code}
            onChange={(e) =>
              setCode(
                mode === "backup"
                  ? e.target.value.toUpperCase()
                  : e.target.value.replace(/\D/g, "").slice(0, 6),
              )
            }
          />
        </Field>

        {mode !== "backup" ? (
          <Switch
            id="trust-device"
            checked={trust}
            onCheckedChange={setTrust}
            label="Trust this device for 30 days"
          />
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Verify and continue
        </Button>
      </form>

      {mode !== "otp" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          loading={sending}
          onClick={sendEmailCode}
        >
          Email me a one-time code instead
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          loading={sending}
          onClick={sendEmailCode}
        >
          Resend the email code
        </Button>
      )}

      <p className="text-center text-xs text-slate-500">
        Lost access to every factor?{" "}
        <a
          href="mailto:security@1security.app?subject=Account%20recovery%20request"
          className="text-cyan-400 hover:text-cyan-300"
        >
          Contact your administrator
        </a>
      </p>
    </div>
  );
}
