"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, PasswordInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PASSWORD_REQUIREMENTS,
  assessPassword,
} from "@/lib/security/password-policy";
import { CheckIcon } from "@/components/ui/icons";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const paramError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const assessment = useMemo(() => assessPassword(password), [password]);
  const mismatch = confirm.length > 0 && confirm !== password;

  if (!token) {
    return (
      <Alert tone="error" title="Invalid reset link">
        {paramError === "INVALID_TOKEN"
          ? "This reset link has expired or was already used. Request a new one."
          : "This page must be opened from the link in the reset email."}{" "}
        <Link
          href="/forgot-password"
          className="underline decoration-dotted underline-offset-2"
        >
          Request a new link
        </Link>
        .
      </Alert>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Password updated">
          Every other session was signed out. Sign in again with your new
          password.
        </Alert>
        <Button className="w-full" onClick={() => router.push("/sign-in")}>
          Continue to sign in
        </Button>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!assessment.valid) {
      setError(assessment.problems[0] ?? "Choose a stronger password.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    setLoading(false);

    if (resetError) {
      setError(
        resetError.message ??
          "Could not reset the password. The link may have expired.",
      );
      return;
    }

    setDone(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Field label="New password" htmlFor="new-password" required>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          required
          placeholder="At least 12 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {password.length > 0 ? (
        <ul className="grid grid-cols-2 gap-1.5">
          {PASSWORD_REQUIREMENTS.map((rule) => {
            const met = assessment[rule.id];
            return (
              <li
                key={rule.id}
                className={cn(
                  "flex items-center gap-1.5 text-[11px]",
                  met ? "text-emerald-300" : "text-slate-500",
                )}
              >
                <CheckIcon size={11} />
                {rule.label}
              </li>
            );
          })}
        </ul>
      ) : null}

      <Field
        label="Confirm new password"
        htmlFor="confirm-password"
        required
        error={mismatch ? "Passwords do not match." : undefined}
      >
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          required
          placeholder="Repeat your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={loading}
        disabled={!assessment.valid || mismatch}
      >
        Update password
      </Button>
    </form>
  );
}
