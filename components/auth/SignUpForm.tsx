"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input, PasswordInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PASSWORD_REQUIREMENTS,
  assessPassword,
} from "@/lib/security/password-policy";
import { CheckIcon, ShieldIcon } from "@/components/ui/icons";

export interface ProviderAvailability {
  google: boolean;
  github: boolean;
  microsoft: boolean;
  linkedin: boolean;
  apple: boolean;
  email: boolean;
  sms: boolean;
}

const strengthColors = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-400",
  "bg-emerald-400",
  "bg-cyan-400",
];

export function SignUpForm({
  providers,
}: {
  providers: ProviderAvailability;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const assessment = useMemo(() => assessPassword(password), [password]);
  const mismatch = confirm.length > 0 && confirm !== password;

  const socialProviders = (
    ["google", "github", "microsoft", "linkedin", "apple"] as const
  ).filter((key) => providers[key]);

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
    if (!accepted) {
      setError("Accept the terms of service to continue.");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: next,
    });

    if (signUpError) {
      setLoading(false);
      setError(
        signUpError.status === 422
          ? "That email address cannot be used. Try another."
          : (signUpError.message ??
            "Could not create the account. Try again shortly."),
      );
      return;
    }

    // When email verification is enforced no session is issued; show the
    // "check your inbox" state instead of pushing to a protected page.
    if (!data?.token && providers.email) {
      setLoading(false);
      setDone(true);
      return;
    }

    router.push(next);
    router.refresh();
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Account created">
          We sent a verification link to <strong>{email}</strong>. Confirm your
          address to activate the account.
        </Alert>
        <p className="text-xs text-slate-400">
          Nothing arrived? Check spam, or{" "}
          <Link href="/verify-email" className="text-cyan-400 hover:text-cyan-300">
            resend the verification email
          </Link>
          .
        </p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => router.push("/sign-in")}
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name" htmlFor="name" required>
          <Input
            id="name"
            autoComplete="name"
            required
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Work email" htmlFor="signup-email" required>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Password" htmlFor="signup-password" required>
          <PasswordInput
            id="signup-password"
            autoComplete="new-password"
            required
            placeholder="At least 12 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {password.length > 0 ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3, 4].map((index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      index <= assessment.score
                        ? strengthColors[assessment.score]
                        : "bg-white/10",
                    )}
                  />
                ))}
              </div>
              <span className="w-20 text-right text-[11px] text-slate-400">
                {assessment.label}
              </span>
            </div>

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
          </div>
        ) : null}

        <Field
          label="Confirm password"
          htmlFor="confirm"
          required
          error={mismatch ? "Passwords do not match." : undefined}
        >
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            required
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-400">
          <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="peer h-4 w-4 appearance-none rounded border border-white/20 bg-white/[0.04] checked:border-cyan-400 checked:bg-cyan-400/90"
            />
            <CheckIcon
              size={11}
              className="pointer-events-none absolute text-slate-950 opacity-0 peer-checked:opacity-100"
            />
          </span>
          <span>
            I agree to the terms of service and acknowledge that security
            activity on this account is logged.
          </span>
        </label>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={!assessment.valid || mismatch || !accepted}
        >
          <ShieldIcon size={16} />
          Create account
        </Button>
      </form>

      {socialProviders.length > 0 ? (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-white/[0.08]" />
            <span className="text-[10px] uppercase tracking-widest text-slate-500">
              or sign up with
            </span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {socialProviders.map((provider) => (
              <Button
                key={provider}
                type="button"
                variant="secondary"
                onClick={() =>
                  authClient.signIn.social({
                    provider: provider as "google",
                    callbackURL: next,
                  })
                }
              >
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </Button>
            ))}
          </div>
        </>
      ) : null}

      <p className="text-center text-xs text-slate-500">
        Already registered?{" "}
        <Link href="/sign-in" className="text-cyan-400 hover:text-cyan-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
